import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { checklistTypeValidator } from "./lib/validators";

export const listWithTasks = query({
  args: { checklistType: v.optional(checklistTypeValidator) },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_sort_order")
      .collect();

    return await Promise.all(
      rooms
        .filter((room) => room.isActive)
        .map(async (room) => {
          const tasks = args.checklistType
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
            tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder),
          };
        })
    );
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("rooms", {
      ...args,
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

