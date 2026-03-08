import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { checklistTypeValidator } from "./lib/validators";
import {
  buildPropertyChecklistOverridesFromBase,
  createChecklistOverrideKey,
  loadBaseTemplateRooms,
  loadEffectivePropertyTemplateRooms,
  roomGenerationModeValidator,
  type PropertyChecklistRoom,
} from "./lib/checklistTemplates";

const STARTER_ROOM_TEMPLATES: Array<{
  name: string;
  sortOrder: number;
  generationMode: "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";
  cleaningTasks: string[];
  inspectionTasks: string[];
}> = [
  {
    name: "Entrance",
    sortOrder: 1,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Sweep and mop entry floor",
      "Wipe door handles and switches",
      "Spot-clean visible walls and baseboards",
    ],
    inspectionTasks: [
      "Entry floor is free of dirt and streaks",
      "Door and touchpoints are clean and presentable",
      "No visible damage or tripping hazards",
    ],
  },
  {
    name: "Kitchen",
    sortOrder: 2,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Sanitize counters and backsplash",
      "Clean sink and faucet",
      "Wipe appliance fronts",
      "Empty trash and replace liner",
      "Sweep and mop floor",
    ],
    inspectionTasks: [
      "Counters, sink, and backsplash pass visual check",
      "Appliance fronts are streak-free",
      "Trash area is clean and odor-free",
      "Kitchen floor edges and corners are clean",
    ],
  },
  {
    name: "Living Room",
    sortOrder: 3,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Dust surfaces and decor",
      "Straighten furniture and cushions",
      "Vacuum or mop flooring",
      "Clean mirrors and glass",
    ],
    inspectionTasks: [
      "High-touch surfaces are dust-free",
      "Furniture is reset to standard",
      "Flooring is clean with no visible debris",
      "Glass and mirrors are streak-free",
    ],
  },
  {
    name: "Bathroom",
    sortOrder: 4,
    generationMode: "PER_BATHROOM",
    cleaningTasks: [
      "Disinfect toilet, sink, and fixtures",
      "Clean shower or tub surfaces",
      "Polish mirror",
      "Restock paper goods and towels",
      "Sweep and mop floor",
    ],
    inspectionTasks: [
      "Fixtures are sanitized and polished",
      "Shower or tub has no residue or hair",
      "Mirror is clean and streak-free",
      "Supplies are fully stocked",
      "Bathroom floor is dry and clean",
    ],
  },
  {
    name: "Bedroom",
    sortOrder: 5,
    generationMode: "PER_BEDROOM",
    cleaningTasks: [
      "Make bed with fresh linens",
      "Dust furniture and nightstands",
      "Reset room presentation",
      "Vacuum or mop floor",
    ],
    inspectionTasks: [
      "Bed is made to standard",
      "Furniture and surfaces are dust-free",
      "Room presentation matches standard",
      "No visible debris on floor",
    ],
  },
  {
    name: "Backyard",
    sortOrder: 6,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Remove visible debris",
      "Wipe outdoor seating surfaces",
      "Reset exterior presentation",
    ],
    inspectionTasks: [
      "Outdoor area is tidy and guest-ready",
      "Furniture is clean and arranged",
      "No visible safety issues",
    ],
  },
  {
    name: "General",
    sortOrder: 7,
    generationMode: "SINGLE",
    cleaningTasks: [
      "Check lights and replace obvious burnt bulbs",
      "Confirm thermostat and key amenities are reset",
      "Final walk-through for presentation",
    ],
    inspectionTasks: [
      "Lights and essential amenities are functional",
      "Thermostat and entry settings are correct",
      "Final presentation meets company standard",
    ],
  },
];

function sortPropertyChecklistRooms(rooms: PropertyChecklistRoom[]) {
  return rooms
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((room) => ({
      ...room,
      tasks: room.tasks.slice().sort((left, right) => {
        if (left.checklistType !== right.checklistType) {
          return left.checklistType.localeCompare(right.checklistType);
        }
        return left.sortOrder - right.sortOrder;
      }),
    }));
}

async function getPropertyForOverrideMutation(
  ctx: MutationCtx,
  propertyId: Id<"properties">
) {
  await requireAdmin(ctx);
  const property = await ctx.db.get(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }
  return property;
}

function requireExistingOverrides(roomOverrides: PropertyChecklistRoom[] | undefined) {
  if (!roomOverrides) {
    throw new Error("Create a property override copy before editing this checklist");
  }
  return roomOverrides;
}

export const listWithTasks = query({
  args: {
    checklistType: v.optional(checklistTypeValidator),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await loadBaseTemplateRooms(ctx, args);
  },
});

export const listEffectiveForProperty = query({
  args: {
    propertyId: v.id("properties"),
    checklistType: v.optional(checklistTypeValidator),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await loadEffectivePropertyTemplateRooms(ctx, args.propertyId, args);
  },
});

export const createPropertyOverrides = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);

    if (property.checklistOverrides) {
      throw new Error("Property overrides already exist. Reset them first if you need a fresh copy");
    }

    const checklistOverrides = await buildPropertyChecklistOverridesFromBase(ctx);
    await ctx.db.patch(args.propertyId, {
      checklistOverrides,
    });

    return {
      roomsCopied: checklistOverrides.rooms.length,
    };
  },
});

export const resetPropertyOverrides = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);

    if (!property.checklistOverrides) {
      return { cleared: false };
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: undefined,
    });

    return { cleared: true };
  },
});

export const createPropertyOverrideRoom = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    generationMode: v.optional(roomGenerationModeValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    const nextRoom: PropertyChecklistRoom = {
      key: createChecklistOverrideKey("room"),
      name: args.name,
      description: args.description,
      sortOrder: args.sortOrder,
      generationMode: args.generationMode ?? "SINGLE",
      isActive: args.isActive ?? true,
      tasks: [],
    };

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms([...rooms, nextRoom]),
      },
    });

    return nextRoom.key;
  },
});

export const updatePropertyOverrideRoom = mutation({
  args: {
    propertyId: v.id("properties"),
    roomKey: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    generationMode: v.optional(roomGenerationModeValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    let found = false;
    const updatedRooms = rooms.map((room) => {
      if (room.key !== args.roomKey) {
        return room;
      }
      found = true;
      return {
        ...room,
        name: args.name ?? room.name,
        description: args.description ?? room.description,
        sortOrder: args.sortOrder ?? room.sortOrder,
        generationMode: args.generationMode ?? room.generationMode,
        isActive: args.isActive ?? room.isActive,
      };
    });

    if (!found) {
      throw new Error("Property override room not found");
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms(updatedRooms),
      },
    });
  },
});

export const removePropertyOverrideRoom = mutation({
  args: {
    propertyId: v.id("properties"),
    roomKey: v.string(),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    const nextRooms = rooms.filter((room) => room.key !== args.roomKey);
    if (nextRooms.length === rooms.length) {
      throw new Error("Property override room not found");
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms(nextRooms),
      },
    });
  },
});

export const createPropertyOverrideTask = mutation({
  args: {
    propertyId: v.id("properties"),
    roomKey: v.string(),
    checklistType: checklistTypeValidator,
    description: v.string(),
    sortOrder: v.number(),
    requiredPhotoMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    let found = false;
    const updatedRooms = rooms.map((room) => {
      if (room.key !== args.roomKey) {
        return room;
      }

      found = true;
      return {
        ...room,
        tasks: [
          ...room.tasks,
          {
            key: createChecklistOverrideKey("task"),
            checklistType: args.checklistType,
            description: args.description,
            sortOrder: args.sortOrder,
            requiredPhotoMin: args.requiredPhotoMin,
          },
        ],
      };
    });

    if (!found) {
      throw new Error("Property override room not found");
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms(updatedRooms),
      },
    });
  },
});

export const updatePropertyOverrideTask = mutation({
  args: {
    propertyId: v.id("properties"),
    roomKey: v.string(),
    taskKey: v.string(),
    checklistType: v.optional(checklistTypeValidator),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    requiredPhotoMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    let roomFound = false;
    let taskFound = false;
    const updatedRooms = rooms.map((room) => {
      if (room.key !== args.roomKey) {
        return room;
      }

      roomFound = true;
      return {
        ...room,
        tasks: room.tasks.map((task) => {
          if (task.key !== args.taskKey) {
            return task;
          }

          taskFound = true;
          return {
            ...task,
            checklistType: args.checklistType ?? task.checklistType,
            description: args.description ?? task.description,
            sortOrder: args.sortOrder ?? task.sortOrder,
            requiredPhotoMin: args.requiredPhotoMin ?? task.requiredPhotoMin,
          };
        }),
      };
    });

    if (!roomFound) {
      throw new Error("Property override room not found");
    }
    if (!taskFound) {
      throw new Error("Property override task not found");
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms(updatedRooms),
      },
    });
  },
});

export const removePropertyOverrideTask = mutation({
  args: {
    propertyId: v.id("properties"),
    roomKey: v.string(),
    taskKey: v.string(),
  },
  handler: async (ctx, args) => {
    const property = await getPropertyForOverrideMutation(ctx, args.propertyId);
    const rooms = requireExistingOverrides(property.checklistOverrides?.rooms);

    let roomFound = false;
    let taskFound = false;
    const updatedRooms = rooms.map((room) => {
      if (room.key !== args.roomKey) {
        return room;
      }

      roomFound = true;
      const nextTasks = room.tasks.filter((task) => task.key !== args.taskKey);
      taskFound = nextTasks.length !== room.tasks.length;
      return {
        ...room,
        tasks: nextTasks,
      };
    });

    if (!roomFound) {
      throw new Error("Property override room not found");
    }
    if (!taskFound) {
      throw new Error("Property override task not found");
    }

    await ctx.db.patch(args.propertyId, {
      checklistOverrides: {
        rooms: sortPropertyChecklistRooms(updatedRooms),
      },
    });
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    generationMode: v.optional(roomGenerationModeValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("rooms", {
      ...args,
      generationMode: args.generationMode ?? "SINGLE",
      isActive: true,
    });
  },
});

export const updateRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    generationMode: v.optional(roomGenerationModeValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { roomId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(roomId, filteredUpdates);
  },
});

export const removeRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    await ctx.db.delete(args.roomId);
  },
});

export const createTask = mutation({
  args: {
    roomId: v.id("rooms"),
    checklistType: checklistTypeValidator,
    description: v.string(),
    sortOrder: v.number(),
    requiredPhotoMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("tasks", args);
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    checklistType: v.optional(checklistTypeValidator),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    requiredPhotoMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { taskId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(taskId, filteredUpdates);
  },
});

export const removeTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.taskId);
  },
});

export const bootstrapStarterTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const existingRooms = await ctx.db.query("rooms").collect();
    if (existingRooms.length > 0) {
      throw new Error("Starter templates can only be added when no room templates exist");
    }

    for (const roomTemplate of STARTER_ROOM_TEMPLATES) {
      const roomId = await ctx.db.insert("rooms", {
        name: roomTemplate.name,
        description: undefined,
        sortOrder: roomTemplate.sortOrder,
        generationMode: roomTemplate.generationMode,
        isActive: true,
      });

      let taskOrder = 1;
      for (const description of roomTemplate.cleaningTasks) {
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
      for (const description of roomTemplate.inspectionTasks) {
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
      roomsCreated: STARTER_ROOM_TEMPLATES.length,
    };
  },
});
