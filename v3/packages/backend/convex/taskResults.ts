import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireTaskResultAccess } from "./lib/permissions";

async function reopenRoomInspectionIfInvalid(
  roomInspectionId: Id<"roomInspections">,
  ctx: MutationCtx
) {
  const roomInspection = await ctx.db.get(roomInspectionId);
  if (!roomInspection || roomInspection.status !== "COMPLETED") {
    return;
  }

  const [taskResults, photos] = await Promise.all([
    ctx.db
      .query("taskResults")
      .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspection._id))
      .collect(),
    ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspection._id))
      .collect(),
  ]);

  const isStillComplete =
    taskResults.every((task) => task.completed) &&
    photos.length >= roomInspection.requiredPhotoMin;

  if (!isStillComplete) {
    await ctx.db.patch(roomInspection._id, {
      status: "PENDING",
      completedAt: undefined,
    });
  }
}

export const toggle = mutation({
  args: { taskResultId: v.id("taskResults") },
  handler: async (ctx, args) => {
    const { taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);

    await ctx.db.patch(args.taskResultId, {
      completed: !taskResult.completed,
    });

    await reopenRoomInspectionIfInvalid(taskResult.roomInspectionId, ctx);
  },
});

export const setCompleted = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { taskResult } = await requireTaskResultAccess(ctx, args.taskResultId);

    await ctx.db.patch(args.taskResultId, {
      completed: args.completed,
    });

    await reopenRoomInspectionIfInvalid(taskResult.roomInspectionId, ctx);
  },
});

export const setIssue = mutation({
  args: {
    taskResultId: v.id("taskResults"),
    hasIssue: v.boolean(),
    issueNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskResultAccess(ctx, args.taskResultId);

    const issueNotes = args.hasIssue ? args.issueNotes?.trim() || undefined : undefined;

    await ctx.db.patch(args.taskResultId, {
      hasIssue: args.hasIssue,
      issueNotes,
    });
  },
});

