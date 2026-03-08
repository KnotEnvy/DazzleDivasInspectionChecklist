import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { checklistTypeValidator } from "./validators";

type Ctx = QueryCtx | MutationCtx;

export type ChecklistType = "CLEANING" | "INSPECTION";
export type RoomGenerationMode = "SINGLE" | "PER_BEDROOM" | "PER_BATHROOM";

export const roomGenerationModeValidator = v.union(
  v.literal("SINGLE"),
  v.literal("PER_BEDROOM"),
  v.literal("PER_BATHROOM")
);

export const propertyChecklistTaskValidator = v.object({
  key: v.string(),
  sourceTaskId: v.optional(v.id("tasks")),
  checklistType: checklistTypeValidator,
  description: v.string(),
  sortOrder: v.number(),
  requiredPhotoMin: v.optional(v.number()),
});

export const propertyChecklistRoomValidator = v.object({
  key: v.string(),
  sourceRoomId: v.optional(v.id("rooms")),
  name: v.string(),
  description: v.optional(v.string()),
  sortOrder: v.number(),
  generationMode: v.optional(roomGenerationModeValidator),
  isActive: v.boolean(),
  tasks: v.array(propertyChecklistTaskValidator),
});

export const propertyChecklistOverrideValidator = v.object({
  rooms: v.array(propertyChecklistRoomValidator),
});

export type PropertyChecklistTask = {
  key: string;
  sourceTaskId?: Id<"tasks">;
  checklistType: ChecklistType;
  description: string;
  sortOrder: number;
  requiredPhotoMin?: number;
};

export type PropertyChecklistRoom = {
  key: string;
  sourceRoomId?: Id<"rooms">;
  name: string;
  description?: string;
  sortOrder: number;
  generationMode?: RoomGenerationMode;
  isActive: boolean;
  tasks: PropertyChecklistTask[];
};

type BaseTemplateTask = {
  _id: Id<"tasks">;
  checklistType: ChecklistType;
  description: string;
  sortOrder: number;
  requiredPhotoMin?: number;
};

type BaseTemplateRoom = {
  _id: Id<"rooms">;
  name: string;
  description?: string;
  sortOrder: number;
  generationMode?: RoomGenerationMode;
  isActive: boolean;
  tasks: BaseTemplateTask[];
};

function sortTasks(tasks: PropertyChecklistTask[]) {
  return tasks.slice().sort((left, right) => {
    if (left.checklistType !== right.checklistType) {
      return left.checklistType.localeCompare(right.checklistType);
    }
    return left.sortOrder - right.sortOrder;
  });
}

function sortRooms(rooms: PropertyChecklistRoom[]) {
  return rooms
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((room) => ({
      ...room,
      tasks: sortTasks(room.tasks),
    }));
}

function filterRoomTasks(
  room: PropertyChecklistRoom,
  checklistType?: ChecklistType
): PropertyChecklistRoom {
  const tasks = checklistType
    ? room.tasks.filter((task) => task.checklistType === checklistType)
    : room.tasks;
  return {
    ...room,
    tasks: sortTasks(tasks),
  };
}

export function createChecklistOverrideKey(prefix: "room" | "task") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function inferRoomGenerationMode(room: {
  name: string;
  generationMode?: RoomGenerationMode;
}) {
  if (room.generationMode) {
    return room.generationMode;
  }

  const normalizedName = room.name.trim().toLowerCase();
  if (normalizedName === "bedroom" || normalizedName.startsWith("bedroom ")) {
    return "PER_BEDROOM" as const;
  }

  if (normalizedName === "bathroom" || normalizedName.startsWith("bathroom ")) {
    return "PER_BATHROOM" as const;
  }

  return "SINGLE" as const;
}

export function deriveRoomNames(params: {
  room: {
    name: string;
    generationMode?: RoomGenerationMode;
  };
  bedrooms?: number;
  bathrooms?: number;
}) {
  const generationMode = inferRoomGenerationMode(params.room);

  if (generationMode === "PER_BEDROOM") {
    const count = Math.max(1, params.bedrooms ?? 1);
    return Array.from({ length: count }, (_, index) => `Bedroom ${index + 1}`);
  }

  if (generationMode === "PER_BATHROOM") {
    const count = Math.max(1, params.bathrooms ?? 1);
    return Array.from({ length: count }, (_, index) => `Bathroom ${index + 1}`);
  }

  return [params.room.name];
}

export async function loadBaseTemplateRooms(
  ctx: Ctx,
  args?: {
    checklistType?: ChecklistType;
    includeInactive?: boolean;
  }
): Promise<BaseTemplateRoom[]> {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_sort_order")
    .collect();

  return await Promise.all(
    rooms
      .filter((room) => (args?.includeInactive === true ? true : room.isActive))
      .map(async (room) => {
        const tasks = args?.checklistType
          ? await ctx.db
              .query("tasks")
              .withIndex("by_room_type_sort", (q) =>
                q.eq("roomId", room._id).eq("checklistType", args.checklistType!)
              )
              .collect()
          : await ctx.db
              .query("tasks")
              .withIndex("by_room", (q) => q.eq("roomId", room._id))
              .collect();

        return {
          ...room,
          tasks: tasks.sort((left, right) => {
            if (left.checklistType !== right.checklistType) {
              return left.checklistType.localeCompare(right.checklistType);
            }
            return left.sortOrder - right.sortOrder;
          }),
        };
      })
  );
}

export async function buildPropertyChecklistOverridesFromBase(ctx: Ctx) {
  const baseRooms = await loadBaseTemplateRooms(ctx, { includeInactive: true });
  return {
    rooms: baseRooms.map((room) => ({
      key: createChecklistOverrideKey("room"),
      sourceRoomId: room._id,
      name: room.name,
      description: room.description,
      sortOrder: room.sortOrder,
      generationMode: room.generationMode,
      isActive: room.isActive,
      tasks: room.tasks.map((task) => ({
        key: createChecklistOverrideKey("task"),
        sourceTaskId: task._id,
        checklistType: task.checklistType,
        description: task.description,
        sortOrder: task.sortOrder,
        requiredPhotoMin: task.requiredPhotoMin,
      })),
    })),
  };
}

export async function loadEffectivePropertyTemplateRooms(
  ctx: Ctx,
  propertyId: Id<"properties">,
  args?: {
    checklistType?: ChecklistType;
    includeInactive?: boolean;
  }
): Promise<{
  source: "BASE_TEMPLATE" | "PROPERTY_OVERRIDE";
  hasOverrides: boolean;
  rooms: PropertyChecklistRoom[];
}> {
  const property = await ctx.db.get(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  if (property.checklistOverrides) {
    const rooms = sortRooms(property.checklistOverrides.rooms)
      .filter((room) => (args?.includeInactive === true ? true : room.isActive))
      .map((room) => filterRoomTasks(room, args?.checklistType));

    return {
      source: "PROPERTY_OVERRIDE",
      hasOverrides: true,
      rooms,
    };
  }

  const baseRooms = await loadBaseTemplateRooms(ctx, args);
  return {
    source: "BASE_TEMPLATE",
    hasOverrides: false,
    rooms: baseRooms.map((room) => ({
      key: room._id,
      sourceRoomId: room._id,
      name: room.name,
      description: room.description,
      sortOrder: room.sortOrder,
      generationMode: room.generationMode,
      isActive: room.isActive,
      tasks: room.tasks.map((task) => ({
        key: task._id,
        sourceTaskId: task._id,
        checklistType: task.checklistType,
        description: task.description,
        sortOrder: task.sortOrder,
        requiredPhotoMin: task.requiredPhotoMin,
      })),
    })),
  };
}
