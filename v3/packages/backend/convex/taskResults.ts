import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTaskResultAccess } from "./lib/permissions";
import {
  adjustInspectionIssueCount,
  adjustRoomInspectionMetrics,
  reopenRoomInspectionIfInvalid,
} from "./lib/inspectionMetrics";

export const toggle = mutation({
  args: { taskResultId: v.id("taskResults") },
  handler: async (ctx, args) => {
    const { roomInspection, taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);
    const nextCompleted = !taskResult.completed;
    const completedDelta = nextCompleted ? 1 : -1;

    await ctx.db.patch(args.taskResultId, {
      completed: nextCompleted,
    });

    const { metrics } = await adjustRoomInspectionMetrics(ctx, taskResult.roomInspectionId, {
      completedTasks: completedDelta,
    });

    await reopenRoomInspectionIfInvalid(ctx, roomInspection, metrics);
  },
});

export const setCompleted = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { roomInspection, taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);

    if (taskResult.completed === args.completed) {
      return;
    }

    await ctx.db.patch(args.taskResultId, {
      completed: args.completed,
    });

    const { metrics } = await adjustRoomInspectionMetrics(ctx, taskResult.roomInspectionId, {
      completedTasks: args.completed ? 1 : -1,
    });

    await reopenRoomInspectionIfInvalid(ctx, roomInspection, metrics);
  },
});

export const setIssue = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    hasIssue: v.boolean(),
    issueNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { inspection, taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);

    const issueNotes = args.hasIssue ? args.issueNotes?.trim() || undefined : undefined;
    const issueDelta =
      taskResult.hasIssue === args.hasIssue ? 0 : args.hasIssue ? 1 : -1;

    await ctx.db.patch(args.taskResultId, {
      hasIssue: args.hasIssue,
      issueNotes,
    });

    if (issueDelta !== 0) {
      await Promise.all([
        adjustRoomInspectionMetrics(ctx, taskResult.roomInspectionId, {
          issueCount: issueDelta,
        }),
        adjustInspectionIssueCount(ctx, inspection._id, issueDelta),
      ]);
    }
  },
});

