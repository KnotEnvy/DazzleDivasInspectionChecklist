import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { userRoleValidator } from "./lib/validators";

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

type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
type AssignmentRole = "CLEANER" | "INSPECTOR";

function isAssignmentRole(role: UserRole): role is AssignmentRole {
  return role === "CLEANER" || role === "INSPECTOR";
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

export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(userRoleValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { userId, ...updates } = args;
    const nextRole = args.role;
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(userId, filteredUpdates);

    if (
      nextRole &&
      nextRole !== currentUser.role &&
      isAssignmentRole(nextRole)
    ) {
      await syncAssignmentsForRoleChange(ctx, userId, nextRole);
    }
  },
});

