import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { userRoleValidator, assignmentRoleValidator } from "./lib/validators";

const RESET_CONFIRM_TOKEN = "RESET_DAZZLE_V3";
const TEST_PILOT_PREFIX = "[TEST PILOT]";
const DAY_MS = 24 * 60 * 60 * 1000;

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

function timestampDaysFromNow(daysFromNow: number, hour: number, minute: number) {
  const timestamp = new Date();
  timestamp.setDate(timestamp.getDate() + daysFromNow);
  timestamp.setHours(hour, minute, 0, 0);
  return timestamp.getTime();
}

type PilotPropertySeed = {
  name: string;
  address: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  entryMethod: string;
  accessInstructions: string;
  serviceNotes: string;
  cleaningNotes: string;
  inspectionNotes: string;
};

const PILOT_PROPERTIES: PilotPropertySeed[] = [
  {
    name: `${TEST_PILOT_PREFIX} Studio Sprint`,
    address: "14 Juniper Walk, Orlando, FL",
    description: "Small 1 bed turnover for fast worker-flow and checklist smoke passes.",
    bedrooms: 1,
    bathrooms: 1,
    entryMethod: "Lockbox",
    accessInstructions:
      "Blue lockbox on porch rail. Confirm key is returned before leaving the property.",
    serviceNotes:
      "Use this location for fast-turn job execution, issue capture, and quick photo minimum validation.",
    cleaningNotes: "Tight turnover window. Prioritize kitchen, bath, and final-entry photo proof.",
    inspectionNotes: "Best property for quick reopen and issue-note validation.",
  },
  {
    name: `${TEST_PILOT_PREFIX} Townhouse Standard`,
    address: "208 Cypress View Dr, Kissimmee, FL",
    description: "Mid-size 2 bed property for routine recurring cleaning and inspection coverage.",
    bedrooms: 2,
    bathrooms: 2,
    entryMethod: "Smart lock",
    accessInstructions:
      "Use smart lock code 2468 for tests. Call admin before changing any thermostat or alarm state.",
    serviceNotes:
      "Use this property for standard weekly cleaning plus follow-up inspection and blocker-state testing.",
    cleaningNotes: "Good baseline property for room progression, room notes, and reschedule testing.",
    inspectionNotes: "Use to validate issue counts in history and report output.",
  },
  {
    name: `${TEST_PILOT_PREFIX} Family Retreat`,
    address: "77 Magnolia Crest Rd, Davenport, FL",
    description: "Larger 4 bed vacation home for multi-room checklist depth and dispatch testing.",
    bedrooms: 4,
    bathrooms: 3,
    entryMethod: "Garage keypad",
    accessInstructions:
      "Garage keypad opens side-entry route. Verify pool door alarm is engaged before checkout.",
    serviceNotes:
      "Use this property to stress room-by-room execution, issue history, and dispatch month/week visibility.",
    cleaningNotes: "Longer duration property intended for full-room completion and photo compliance testing.",
    inspectionNotes: "Best seeded property for report-review and cross-device conflict drills.",
  },
  {
    name: `${TEST_PILOT_PREFIX} Estate Deep Run`,
    address: "912 Lakeview Preserve Blvd, Clermont, FL",
    description: "Large 6 bed property for high-room-count manual testing and scale checks.",
    bedrooms: 6,
    bathrooms: 4,
    entryMethod: "Owner app key",
    accessInstructions:
      "Entry through side service door. Do not enter owner closet. Use checklist notes for supply exceptions.",
    serviceNotes:
      "Use for large-property dispatch, staffing review, worker mobile scanning, and completion timing drills.",
    cleaningNotes: "Designed for schedule-volume and long-form checklist testing.",
    inspectionNotes: "Use for final pilot-day end-to-end validation with the full field path.",
  },
];

async function findPilotProperties(ctx: any) {
  const properties = await ctx.db.query("properties").collect();
  return properties.filter((property: Doc<"properties">) =>
    property.name.startsWith(TEST_PILOT_PREFIX)
  );
}

async function deleteInspectionTree(ctx: any, inspectionIds: Id<"inspections">[]) {
  let deletedPhotos = 0;
  let deletedTaskResults = 0;
  let deletedRoomInspections = 0;
  let deletedInspections = 0;

  for (const inspectionId of inspectionIds) {
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_inspection", (q: any) => q.eq("inspectionId", inspectionId))
      .collect();
    for (const photo of photos) {
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
      deletedPhotos += 1;
    }

    const taskResults = await ctx.db
      .query("taskResults")
      .withIndex("by_inspection", (q: any) => q.eq("inspectionId", inspectionId))
      .collect();
    for (const taskResult of taskResults) {
      await ctx.db.delete(taskResult._id);
      deletedTaskResults += 1;
    }

    const roomInspections = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q: any) => q.eq("inspectionId", inspectionId))
      .collect();
    for (const roomInspection of roomInspections) {
      await ctx.db.delete(roomInspection._id);
      deletedRoomInspections += 1;
    }

    await ctx.db.delete(inspectionId);
    deletedInspections += 1;
  }

  return {
    deletedPhotos,
    deletedTaskResults,
    deletedRoomInspections,
    deletedInspections,
  };
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

export const seedPilotTestProperties = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    const existingPilotProperties = await findPilotProperties(ctx);
    if (existingPilotProperties.length > 0) {
      throw new Error(
        "Pilot property seed aborted: existing [TEST PILOT] properties found. Run removePilotTestProperties first if you want a clean reseed."
      );
    }

    const users = (await ctx.db.query("users").collect()).filter(
      (user: Doc<"users">) => user.isActive
    );
    const admin = users.find((user) => user.role === "ADMIN");
    const cleaners = users.filter((user) => user.role === "CLEANER");
    const inspectors = users.filter((user) => user.role === "INSPECTOR");
    const cleanerDefaultAssigneeId = cleaners[0]?._id;
    const inspectorDefaultAssigneeId = inspectors[0]?._id;

    let createdProperties = 0;
    let createdAssignments = 0;
    let createdPlans = 0;
    let createdJobs = 0;

    for (let index = 0; index < PILOT_PROPERTIES.length; index += 1) {
      const propertySeed = PILOT_PROPERTIES[index];
      const propertyId = await ctx.db.insert("properties", {
        name: propertySeed.name,
        address: propertySeed.address,
        description: propertySeed.description,
        propertyType: "RESIDENTIAL",
        bedrooms: propertySeed.bedrooms,
        bathrooms: propertySeed.bathrooms,
        notes: `${TEST_PILOT_PREFIX} Safe internal-network seed property. Remove with devTools.removePilotTestProperties when finished.`,
        timezone: "America/New_York",
        accessInstructions: propertySeed.accessInstructions,
        entryMethod: propertySeed.entryMethod,
        serviceNotes: propertySeed.serviceNotes,
        activeCleanerAssignments: cleaners.length,
        activeInspectorAssignments: inspectors.length,
        activeServicePlans: 2,
        isArchived: false,
        isActive: true,
      });
      createdProperties += 1;

      for (const cleaner of cleaners) {
        await ctx.db.insert("propertyAssignments", {
          propertyId,
          userId: cleaner._id,
          assignmentRole: "CLEANER",
          startDate: Date.now(),
          isActive: true,
        });
        createdAssignments += 1;
      }

      for (const inspector of inspectors) {
        await ctx.db.insert("propertyAssignments", {
          propertyId,
          userId: inspector._id,
          assignmentRole: "INSPECTOR",
          startDate: Date.now(),
          isActive: true,
        });
        createdAssignments += 1;
      }

      const cleaningDayOffset = index;
      const inspectionDayOffset = index + 1;
      const cleaningStart = timestampDaysFromNow(cleaningDayOffset, 10, 0);
      const cleaningEnd = timestampDaysFromNow(cleaningDayOffset, 13, 0);
      const inspectionStart = timestampDaysFromNow(inspectionDayOffset, 14, 0);
      const inspectionEnd = timestampDaysFromNow(inspectionDayOffset, 15, 30);

      const cleaningPlanId = await ctx.db.insert("servicePlans", {
        propertyId,
        planType: "CLEANING",
        frequency: "WEEKLY",
        daysOfWeek: [new Date(cleaningStart).getDay()],
        timeWindowStart: "10:00",
        timeWindowEnd: "13:00",
        defaultDurationMinutes: 180,
        defaultAssigneeRole: "CLEANER",
        defaultAssigneeId: cleanerDefaultAssigneeId,
        priority: "HIGH",
        notes: propertySeed.cleaningNotes,
        anchorDate: cleaningStart,
        isActive: true,
      });
      createdPlans += 1;

      const inspectionPlanId = await ctx.db.insert("servicePlans", {
        propertyId,
        planType: "INSPECTION",
        frequency: "WEEKLY",
        daysOfWeek: [new Date(inspectionStart).getDay()],
        timeWindowStart: "14:00",
        timeWindowEnd: "15:30",
        defaultDurationMinutes: 90,
        defaultAssigneeRole: "INSPECTOR",
        defaultAssigneeId: inspectorDefaultAssigneeId,
        priority: "MEDIUM",
        notes: propertySeed.inspectionNotes,
        anchorDate: inspectionStart,
        isActive: true,
      });
      createdPlans += 1;

      if (!admin) {
        continue;
      }

      const cleaningJobId = await ctx.db.insert("jobs", {
        propertyId,
        servicePlanId: cleaningPlanId,
        jobType: "CLEANING",
        scheduledStart: cleaningStart,
        scheduledEnd: cleaningEnd,
        assigneeId: cleanerDefaultAssigneeId,
        status: "SCHEDULED",
        priority: "HIGH",
        notes: `${TEST_PILOT_PREFIX} Seeded cleaning job for internal network testing.`,
        createdById: admin._id,
      });
      createdJobs += 1;

      await ctx.db.insert("jobEvents", {
        jobId: cleaningJobId,
        eventType: "JOB_SEEDED",
        actorId: admin._id,
        metadata: JSON.stringify({
          source: "devTools.seedPilotTestProperties",
          testPilotProperty: propertySeed.name,
        }),
        createdAt: Date.now(),
      });

      const inspectionJobId = await ctx.db.insert("jobs", {
        propertyId,
        servicePlanId: inspectionPlanId,
        jobType: "INSPECTION",
        scheduledStart: inspectionStart,
        scheduledEnd: inspectionEnd,
        assigneeId: inspectorDefaultAssigneeId,
        status: "SCHEDULED",
        priority: "MEDIUM",
        notes: `${TEST_PILOT_PREFIX} Seeded inspection job for internal network testing.`,
        createdById: admin._id,
      });
      createdJobs += 1;

      await ctx.db.insert("jobEvents", {
        jobId: inspectionJobId,
        eventType: "JOB_SEEDED",
        actorId: admin._id,
        metadata: JSON.stringify({
          source: "devTools.seedPilotTestProperties",
          testPilotProperty: propertySeed.name,
        }),
        createdAt: Date.now(),
      });
    }

    return {
      ok: true,
      createdProperties,
      createdAssignments,
      createdPlans,
      createdJobs,
      cleanerCount: cleaners.length,
      inspectorCount: inspectors.length,
      hasAdminForJobs: !!admin,
      propertyNames: PILOT_PROPERTIES.map((property) => property.name),
      message: admin
        ? "Seeded 4 internal-network test properties with assignments, recurring plans, and upcoming jobs."
        : "Seeded 4 internal-network test properties and recurring plans, but no admin user was available so seeded jobs were skipped.",
    };
  },
});

export const removePilotTestProperties = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    assertDevDeployment();
    assertToken(args.confirm);

    const pilotProperties = await findPilotProperties(ctx);
    if (pilotProperties.length === 0) {
      return {
        ok: true,
        deletedProperties: 0,
        deletedAssignments: 0,
        deletedPlans: 0,
        deletedJobs: 0,
        deletedJobEvents: 0,
        deletedInspections: 0,
        deletedRoomInspections: 0,
        deletedTaskResults: 0,
        deletedPhotos: 0,
        message: "No [TEST PILOT] properties were found.",
      };
    }

    let deletedAssignments = 0;
    let deletedPlans = 0;
    let deletedJobs = 0;
    let deletedJobEvents = 0;

    const propertyIds = pilotProperties.map((property: Doc<"properties">) => property._id);
    const inspectionIds: Id<"inspections">[] = [];

    for (const propertyId of propertyIds) {
      const assignments = await ctx.db
        .query("propertyAssignments")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .collect();
      for (const assignment of assignments) {
        await ctx.db.delete(assignment._id);
        deletedAssignments += 1;
      }

      const plans = await ctx.db
        .query("servicePlans")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .collect();
      for (const plan of plans) {
        await ctx.db.delete(plan._id);
        deletedPlans += 1;
      }

      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .collect();
      for (const job of jobs) {
        if (job.linkedInspectionId) {
          inspectionIds.push(job.linkedInspectionId);
        }

        const jobEvents = await ctx.db
          .query("jobEvents")
          .withIndex("by_job", (q: any) => q.eq("jobId", job._id))
          .collect();
        for (const event of jobEvents) {
          await ctx.db.delete(event._id);
          deletedJobEvents += 1;
        }

        await ctx.db.delete(job._id);
        deletedJobs += 1;
      }

      const propertyInspections = await ctx.db
        .query("inspections")
        .withIndex("by_property", (q: any) => q.eq("propertyId", propertyId))
        .collect();
      for (const inspection of propertyInspections) {
        inspectionIds.push(inspection._id);
      }
    }

    const deletedInspectionTree = await deleteInspectionTree(
      ctx,
      Array.from(new Set(inspectionIds))
    );

    for (const property of pilotProperties) {
      await ctx.db.delete(property._id);
    }

    return {
      ok: true,
      deletedProperties: pilotProperties.length,
      deletedAssignments,
      deletedPlans,
      deletedJobs,
      deletedJobEvents,
      deletedInspections: deletedInspectionTree.deletedInspections,
      deletedRoomInspections: deletedInspectionTree.deletedRoomInspections,
      deletedTaskResults: deletedInspectionTree.deletedTaskResults,
      deletedPhotos: deletedInspectionTree.deletedPhotos,
      message: "Removed [TEST PILOT] properties and their related test data.",
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
