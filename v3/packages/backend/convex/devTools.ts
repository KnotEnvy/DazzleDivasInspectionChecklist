import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { userRoleValidator, assignmentRoleValidator } from "./lib/validators";

const RESET_CONFIRM_TOKEN = "RESET_DAZZLE_V3";

function assertDevDeployment() {
  const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
  // In some local/dev runtime contexts this env var can be unset.
  // Only explicitly block known prod deployments.
  if (deployment && !deployment.startsWith("dev:")) {
    throw new Error("This mutation is only allowed on a dev deployment");
  }
}

function assertToken(confirm: string) {
  if (confirm !== RESET_CONFIRM_TOKEN) {
    throw new Error(
      `Invalid confirm token. Expected: ${RESET_CONFIRM_TOKEN}`
    );
  }
}

async function clearTable(ctx: any, tableName: string) {
  const docs = await ctx.db.query(tableName).collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
  return docs.length;
}

export const resetProjectData = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    // Delete storage-backed files first.
    const photos = await ctx.db.query("photos").collect();
    for (const photo of photos) {
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
    }

    const deleted = {
      photos: photos.length,
      taskResults: await clearTable(ctx, "taskResults"),
      roomInspections: await clearTable(ctx, "roomInspections"),
      inspections: await clearTable(ctx, "inspections"),
      propertyAssignments: await clearTable(ctx, "propertyAssignments"),
      tasks: await clearTable(ctx, "tasks"),
      rooms: await clearTable(ctx, "rooms"),
      properties: await clearTable(ctx, "properties"),
      authVerificationCodes: await clearTable(ctx, "authVerificationCodes"),
      authRefreshTokens: await clearTable(ctx, "authRefreshTokens"),
      authSessions: await clearTable(ctx, "authSessions"),
      authVerifiers: await clearTable(ctx, "authVerifiers"),
      authAccounts: await clearTable(ctx, "authAccounts"),
      authRateLimits: await clearTable(ctx, "authRateLimits"),
      users: await clearTable(ctx, "users"),
    };

    return {
      ok: true,
      deleted,
      message:
        "Project data wiped. Sign up test users again, then run seedStarterData.",
    };
  },
});

const ROOM_TEMPLATES: Array<{
  name: string;
  sortOrder: number;
  generationMode?: "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";
  cleaningTasks: string[];
  inspectionTasks: string[];
}> = [
  {
    name: "Entrance",
    sortOrder: 1,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Sweep and mop entry floor",
      "Wipe door handles",
      "Spot-clean walls and baseboards",
    ],
    inspectionTasks: [
      "Entry floor free of debris and streaks",
      "Door and hardware are clean and functional",
      "No visible damage or hazards",
    ],
  },
  {
    name: "Kitchen",
    sortOrder: 2,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Sanitize countertops",
      "Clean appliance fronts",
      "Empty trash and replace liner",
      "Mop kitchen floor",
    ],
    inspectionTasks: [
      "Counters and sink pass visual clean check",
      "Appliance surfaces are streak-free",
      "Floor corners and edges are clean",
      "Trash area is clean and odor-free",
    ],
  },
  {
    name: "Living Room",
    sortOrder: 3,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Dust surfaces",
      "Vacuum or mop flooring",
      "Clean mirrors and glass",
    ],
    inspectionTasks: [
      "No dust visible on high-touch surfaces",
      "Flooring looks uniform and clean",
      "Glass surfaces are streak-free",
    ],
  },
  {
    name: "Bathroom",
    sortOrder: 4,
    generationMode: "PER_BATHROOM",
    cleaningTasks: [
      "Disinfect toilet and sink",
      "Clean shower/tub surfaces",
      "Replace towels and supplies",
      "Mop floor",
    ],
    inspectionTasks: [
      "Fixtures are sanitized and polished",
      "Shower/tub has no residue",
      "Supplies are fully restocked",
      "Bathroom floor is dry and clean",
    ],
  },
  {
    name: "Bedroom",
    sortOrder: 5,
    generationMode: "PER_BEDROOM",
    cleaningTasks: [
      "Make bed with fresh linens",
      "Dust surfaces and nightstands",
      "Vacuum or mop floor",
    ],
    inspectionTasks: [
      "Bed is made to standard",
      "Furniture and surfaces are dust-free",
      "No visible debris on floor",
    ],
  },
];

const SAMPLE_PROPERTIES = [
  {
    name: "Maple Retreat",
    address: "101 Maple St, Orlando, FL",
    propertyType: "RESIDENTIAL" as const,
    bedrooms: 3,
    bathrooms: 2,
    notes: "Primary demo property",
  },
  {
    name: "Sunset Loft",
    address: "22 Sunset Ave, Tampa, FL",
    propertyType: "RESIDENTIAL" as const,
    bedrooms: 2,
    bathrooms: 2,
    notes: "High-turnover unit",
  },
  {
    name: "Dazzle Office",
    address: "500 Business Way, Miami, FL",
    propertyType: "COMMERCIAL" as const,
    notes: "Commercial checklist demo",
  },
];

export const seedStarterData = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    const existingRooms = await ctx.db.query("rooms").collect();
    const existingProperties = await ctx.db.query("properties").collect();

    if (existingRooms.length > 0 || existingProperties.length > 0) {
      throw new Error(
        "Seed aborted: existing room/property data found. Run resetProjectData first if you want a clean reseed."
      );
    }

    for (const property of SAMPLE_PROPERTIES) {
      await ctx.db.insert("properties", {
        ...property,
        isActive: true,
      });
    }

    for (const template of ROOM_TEMPLATES) {
      const roomId = await ctx.db.insert("rooms", {
        name: template.name,
        sortOrder: template.sortOrder,
        generationMode: template.generationMode ?? "SINGLE",
        isActive: true,
      });

      let taskOrder = 1;
      for (const description of template.cleaningTasks) {
        await ctx.db.insert("tasks", {
          roomId,
          checklistType: "CLEANING",
          description,
          sortOrder: taskOrder,
          requiredPhotoMin: 2,
        });
        taskOrder += 1;
      }

      taskOrder = 1;
      for (const description of template.inspectionTasks) {
        await ctx.db.insert("tasks", {
          roomId,
          checklistType: "INSPECTION",
          description,
          sortOrder: taskOrder,
          requiredPhotoMin: 2,
        });
        taskOrder += 1;
      }
    }

    return {
      ok: true,
      message: "Starter properties, rooms, and tasks seeded.",
    };
  },
});

export const setUserRoleByEmail = mutation({
  args: {
    confirm: v.string(),
    email: v.string(),
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new Error(`User not found for email: ${args.email}`);
    }

    await ctx.db.patch(user._id, {
      role: args.role,
      isActive: true,
    });

    return {
      ok: true,
      userId: user._id,
      email: args.email,
      role: args.role,
    };
  },
});

export const assignUserToAllProperties = mutation({
  args: {
    confirm: v.string(),
    email: v.string(),
    assignmentRole: assignmentRoleValidator,
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new Error(`User not found for email: ${args.email}`);
    }

    if (user.role !== args.assignmentRole) {
      throw new Error(
        `User role (${user.role}) must match assignmentRole (${args.assignmentRole})`
      );
    }

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();

    let created = 0;

    for (const property of properties) {
      const existing = await ctx.db
        .query("propertyAssignments")
        .withIndex("by_property_user_role_active", (q: any) =>
          q
            .eq("propertyId", property._id)
            .eq("userId", user._id)
            .eq("assignmentRole", args.assignmentRole)
            .eq("isActive", true)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("propertyAssignments", {
          propertyId: property._id,
          userId: user._id,
          assignmentRole: args.assignmentRole,
          startDate: Date.now(),
          isActive: true,
        });
        created += 1;
      }
    }

    return {
      ok: true,
      assigned: created,
      totalProperties: properties.length,
      email: args.email,
      role: args.assignmentRole,
    };
  },
});

export const listSetupUsers = query({
  args: {},
  handler: async (ctx) => {
    assertDevDeployment();
    const users = await ctx.db.query("users").collect();
    return users
      .map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});
