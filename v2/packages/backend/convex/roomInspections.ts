import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/permissions";

/**
 * Get a room inspection with all task results and photos.
 */
export const getById = query({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const roomInspection = await ctx.db.get(args.roomInspectionId);
    if (!roomInspection) return null;

    const taskResults = await ctx.db
      .query("taskResults")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    return {
      ...roomInspection,
      taskResults: taskResults.sort((a, b) => {
        // Sort by the original task sort order if available
        return a._creationTime - b._creationTime;
      }),
      photos,
    };
  },
});

/**
 * Update room inspection notes.
 */
export const updateNotes = mutation({
  args: {
    roomInspectionId: v.id("roomInspections"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.patch(args.roomInspectionId, { notes: args.notes });
  },
});

/**
 * Complete a room inspection.
 */
export const complete = mutation({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Validate: check photo minimum
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    if (photos.length < 2) {
      throw new Error(
        "At least 2 photos are required to complete a room inspection"
      );
    }

    await ctx.db.patch(args.roomInspectionId, {
      status: "COMPLETED",
      completedAt: Date.now(),
    });
  },
});
