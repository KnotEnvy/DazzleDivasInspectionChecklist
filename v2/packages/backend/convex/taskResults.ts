import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/permissions";

/**
 * Toggle a task's completion status.
 */
export const toggle = mutation({
  args: { taskResultId: v.id("taskResults") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const task = await ctx.db.get(args.taskResultId);
    if (!task) throw new Error("Task result not found");
    await ctx.db.patch(args.taskResultId, { completed: !task.completed });
  },
});

/**
 * Set a task's completion status explicitly.
 */
export const setCompleted = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.taskResultId, { completed: args.completed });
  },
});
