import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { userRoleValidator } from "./lib/validators";
import {
  buildPasswordSetupRedirectPath,
  buildUserProfile,
  normalizeEmail,
  type PasswordSetupStatus,
  type UserRole,
} from "./auth";

const passwordSetupStatusValidator = v.union(
  v.literal("SELF_SIGNUP"),
  v.literal("ADMIN_BOOTSTRAP"),
  v.literal("INVITED"),
  v.literal("PASSWORD_SET")
);

type AssignmentRole = "CLEANER" | "INSPECTOR";
type AdminActor = {
  _id: Id<"users">;
  role: UserRole;
  isActive: boolean;
};

type StaffInviteResult = {
  userId: Id<"users">;
  email: string;
  role: UserRole;
  isActive: boolean;
  inviteSent: boolean;
  inviteSentAt?: number;
  inviteError?: string;
};

function validatePasswordRequirements(password: string) {
  if (!password || password.length < 8) {
    throw new Error("Initial password must be at least 8 characters");
  }
}

function requireBootstrapSecret(secret: string) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
  if (!expected) {
    throw new Error("ADMIN_BOOTSTRAP_SECRET is not configured");
  }
  if (secret !== expected) {
    throw new Error("Invalid bootstrap secret");
  }
}

function generateInternalPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const core = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${core}!a1`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isAssignmentRole(role: UserRole): role is AssignmentRole {
  return role === "CLEANER" || role === "INSPECTOR";
}

async function insertUserAdminEvent(
  ctx: MutationCtx,
  params: {
    actorId: Id<"users">;
    targetUserId: Id<"users">;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.db.insert("userAdminEvents", {
    actorId: params.actorId,
    targetUserId: params.targetUserId,
    eventType: params.eventType,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    createdAt: Date.now(),
  });
}

async function syncAssignmentsForRoleChange(
  ctx: MutationCtx,
  userId: Id<"users">,
  nextRole: AssignmentRole
) {
  const now = Date.now();
  const assignments = await ctx.db
    .query("propertyAssignments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const activeAssignments = assignments.filter((assignment) => assignment.isActive);
  const propertyIds = Array.from(new Set(activeAssignments.map((assignment) => assignment.propertyId)));

  for (const assignment of activeAssignments) {
    if (assignment.assignmentRole !== nextRole) {
      await ctx.db.patch(assignment._id, {
        isActive: false,
        endDate: now,
      });
    }
  }

  for (const propertyId of propertyIds) {
    const existing = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property_user_role_active", (q) =>
        q
          .eq("propertyId", propertyId)
          .eq("userId", userId)
          .eq("assignmentRole", nextRole)
          .eq("isActive", true)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("propertyAssignments", {
        propertyId,
        userId,
        assignmentRole: nextRole,
        startDate: now,
        isActive: true,
      });
    }
  }
}

async function requireAdminActorForAction(ctx: ActionCtx): Promise<AdminActor> {
  const actorId = await getAuthUserId(ctx);
  if (!actorId) {
    throw new Error("Not authenticated");
  }

  const actor = (await ctx.runQuery(internal.users.getByIdInternal, {
    userId: actorId,
  })) as AdminActor | null;

  if (!actor) {
    throw new Error("User not found");
  }

  if (!actor.isActive) {
    throw new Error("Account is deactivated");
  }

  if (actor.role !== "ADMIN") {
    throw new Error("Admin access required");
  }

  return actor;
}

async function updateInviteState(
  ctx: ActionCtx,
  params: {
    userId: Id<"users">;
    passwordSetupStatus?: PasswordSetupStatus;
    inviteSentAt?: number;
    inviteDeliveryError?: string;
    clearInviteSentAt?: boolean;
    clearInviteDeliveryError?: boolean;
  }
) {
  await ctx.runMutation(internal.users.updateOnboardingStateInternal, params);
}

async function deliverStaffInvite(
  ctx: ActionCtx,
  user: Pick<Doc<"users">, "_id" | "email">,
  actor: AdminActor,
  eventType: string
): Promise<{ inviteSent: boolean; inviteSentAt?: number; inviteError?: string }> {
  try {
    await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "reset",
        email: user.email,
        redirectTo: buildPasswordSetupRedirectPath(user.email),
      },
    });

    const inviteSentAt = Date.now();
    await updateInviteState(ctx, {
      userId: user._id,
      passwordSetupStatus: "INVITED",
      inviteSentAt,
      clearInviteDeliveryError: true,
    });

    await ctx.runMutation(internal.users.recordAdminEventInternal, {
      actorId: actor._id,
      targetUserId: user._id,
      eventType,
      metadata: JSON.stringify({ email: user.email, inviteSentAt }),
    });

    return { inviteSent: true, inviteSentAt };
  } catch (error) {
    const inviteError = errorMessage(error);
    await updateInviteState(ctx, {
      userId: user._id,
      passwordSetupStatus: "INVITED",
      inviteDeliveryError: inviteError,
    });

    await ctx.runMutation(internal.users.recordAdminEventInternal, {
      actorId: actor._id,
      targetUserId: user._id,
      eventType: `${eventType}_FAILED`,
      metadata: JSON.stringify({ email: user.email, inviteError }),
    });

    return { inviteSent: false, inviteError };
  }
}

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const listByRole = query({
  args: { role: userRoleValidator },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect()
      .then((users) => users.filter((user) => user.isActive));
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const countAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return { count: users.length };
  },
});

export const recordAdminEventInternal = internalMutation({
  args: {
    actorId: v.id("users"),
    targetUserId: v.id("users"),
    eventType: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("userAdminEvents", {
      actorId: args.actorId,
      targetUserId: args.targetUserId,
      eventType: args.eventType,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const updateOnboardingStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    passwordSetupStatus: v.optional(passwordSetupStatusValidator),
    inviteSentAt: v.optional(v.number()),
    inviteDeliveryError: v.optional(v.string()),
    clearInviteSentAt: v.optional(v.boolean()),
    clearInviteDeliveryError: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | number | undefined> = {};

    if (args.passwordSetupStatus !== undefined) {
      patch.passwordSetupStatus = args.passwordSetupStatus;
    }
    if (args.inviteSentAt !== undefined) {
      patch.inviteSentAt = args.inviteSentAt;
    }
    if (args.inviteDeliveryError !== undefined) {
      patch.inviteDeliveryError = args.inviteDeliveryError;
    }
    if (args.clearInviteSentAt) {
      patch.inviteSentAt = undefined;
    }
    if (args.clearInviteDeliveryError) {
      patch.inviteDeliveryError = undefined;
    }

    await ctx.db.patch(args.userId, patch);
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(userRoleValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);

    const { userId, ...updates } = args;
    const nextRole = args.role;
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    const changedFields = Object.fromEntries(
      Object.entries(filteredUpdates).filter(([key, value]) => currentUser[key as keyof typeof currentUser] !== value)
    );

    if (Object.keys(changedFields).length === 0) {
      return;
    }

    await ctx.db.patch(userId, filteredUpdates);

    if (nextRole && nextRole !== currentUser.role && isAssignmentRole(nextRole)) {
      await syncAssignmentsForRoleChange(ctx, userId, nextRole);
    }

    await insertUserAdminEvent(ctx, {
      actorId: actor._id,
      targetUserId: userId,
      eventType: "USER_UPDATED",
      metadata: changedFields,
    });
  },
});

export const completePasswordSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, {
      passwordSetupStatus: "PASSWORD_SET",
      inviteDeliveryError: undefined,
    });
  },
});

export const createStaffAccount = action({
  args: {
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<StaffInviteResult> => {
    const actor = await requireAdminActorForAction(ctx);
    const email = normalizeEmail(args.email);

    try {
      const created = (await createAccount(ctx, {
        provider: "password",
        account: {
          id: email,
          secret: generateInternalPassword(),
        },
        profile: buildUserProfile({
          name: args.name,
          email,
          role: args.role,
          isActive: args.isActive,
          createdById: actor._id,
          provisionedByAdmin: true,
          passwordSetupStatus: "INVITED",
        }),
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      })) as {
        user: {
          _id: Id<"users">;
          role: UserRole;
          isActive: boolean;
          email: string;
        };
      };

      await ctx.runMutation(internal.users.recordAdminEventInternal, {
        actorId: actor._id,
        targetUserId: created.user._id,
        eventType: "USER_CREATED",
        metadata: JSON.stringify({
          email,
          role: args.role,
          isActive: args.isActive,
          provisionedByAdmin: true,
          onboarding: "INVITE_LINK",
        }),
      });

      let inviteResult: { inviteSent: boolean; inviteSentAt?: number; inviteError?: string };
      if (args.isActive) {
        inviteResult = await deliverStaffInvite(
          ctx,
          { _id: created.user._id, email },
          actor,
          "USER_INVITED"
        );
      } else {
        const inviteError = "Account created as inactive. Activate it before sending an invite.";
        await updateInviteState(ctx, {
          userId: created.user._id,
          passwordSetupStatus: "INVITED",
          inviteDeliveryError: inviteError,
          clearInviteSentAt: true,
        });
        inviteResult = { inviteSent: false, inviteError };
      }

      return {
        userId: created.user._id,
        email,
        role: created.user.role,
        isActive: created.user.isActive,
        inviteSent: inviteResult.inviteSent,
        inviteSentAt: inviteResult.inviteSentAt,
        inviteError: inviteResult.inviteError,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("already exists") ||
          error.message.includes("Account") ||
          error.message.includes("duplicate"))
      ) {
        throw new Error("A user with this email already exists");
      }

      throw error;
    }
  },
});

export const resendStaffInvite = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<StaffInviteResult> => {
    const actor = await requireAdminActorForAction(ctx);
    const user = (await ctx.runQuery(internal.users.getByIdInternal, {
      userId: args.userId,
    })) as Doc<"users"> | null;

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isActive) {
      throw new Error("Activate this user before sending an invite");
    }

    const inviteResult = await deliverStaffInvite(
      ctx,
      { _id: user._id, email: user.email },
      actor,
      "USER_INVITE_RESENT"
    );

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      inviteSent: inviteResult.inviteSent,
      inviteSentAt: inviteResult.inviteSentAt,
      inviteError: inviteResult.inviteError,
    };
  },
});

export const bootstrapFirstAdmin = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    bootstrapSecret: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ userId: Id<"users">; email: string; role: UserRole; isActive: boolean }> => {
    requireBootstrapSecret(args.bootstrapSecret);
    validatePasswordRequirements(args.password);

    const existingUsers = await ctx.runQuery(internal.users.countAllInternal, {});
    if (existingUsers.count > 0) {
      throw new Error("First-admin bootstrap is only allowed when no users exist");
    }

    const email = normalizeEmail(args.email);

    try {
      const created = (await createAccount(ctx, {
        provider: "password",
        account: {
          id: email,
          secret: args.password,
        },
        profile: buildUserProfile({
          name: args.name,
          email,
          role: "ADMIN",
          isActive: true,
          provisionedByAdmin: true,
          passwordSetupStatus: "ADMIN_BOOTSTRAP",
        }),
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      })) as {
        user: {
          _id: Id<"users">;
          role: UserRole;
          isActive: boolean;
        };
      };

      return {
        userId: created.user._id,
        email,
        role: created.user.role,
        isActive: created.user.isActive,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("already exists") ||
          error.message.includes("Account") ||
          error.message.includes("duplicate"))
      ) {
        throw new Error("A user with this email already exists");
      }

      throw error;
    }
  },
});



