import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";

/**
 * List all room templates ordered by sortOrder.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("rooms")
      .withIndex("by_sort_order")
      .collect();
  },
});

/**
 * List all room templates with their tasks.
 */
export const listWithTasks = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_sort_order")
      .collect();

    return await Promise.all(
      rooms.map(async (room) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();
        return { ...room, tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder) };
      })
    );
  },
});

/**
 * Create a room template (admin only).
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("rooms", args);
  },
});

/**
 * Update a room template (admin only).
 */
export const update = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { roomId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(roomId, filtered);
  },
});

/**
 * Delete a room template and its tasks (admin only).
 */
export const remove = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Delete associated tasks first
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

/**
 * Create a task under a room template (admin only).
 */
export const createTask = mutation({
  args: {
    roomId: v.id("rooms"),
    description: v.string(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("tasks", args);
  },
});

/**
 * Update a task (admin only).
 */
export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { taskId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(taskId, filtered);
  },
});

/**
 * Delete a task (admin only).
 */
export const removeTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.taskId);
  },
});
