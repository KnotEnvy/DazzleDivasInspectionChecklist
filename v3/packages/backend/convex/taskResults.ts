import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTaskResultAccess } from "./lib/permissions";

export const toggle = mutation({
  args: { taskResultId: v.id("taskResults") },
  handler: async (ctx, args) => {
    const { taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);

    await ctx.db.patch(args.taskResultId, {
      completed: !taskResult.completed,
    });
  },
});

export const setCompleted = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireTaskResultAccess(ctx, args.taskResultId);

    await ctx.db.patch(args.taskResultId, {
      completed: args.completed,
    });
  },
});

