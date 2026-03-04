import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRoomInspectionAccess } from "./lib/permissions";

export const getById = query({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    const { roomInspection } = await requireRoomInspectionAccess(
      ctx,
      args.roomInspectionId
    );

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

    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const url = await ctx.storage.getUrl(photo.storageId);
        return {
          ...photo,
          url,
        };
      })
    );

    return {
      ...roomInspection,
      taskResults: taskResults.sort((a, b) => a._creationTime - b._creationTime),
      photos: photosWithUrls,
    };
  },
});

export const updateNotes = mutation({
  args: {
    roomInspectionId: v.id("roomInspections"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRoomInspectionAccess(ctx, args.roomInspectionId);

    await ctx.db.patch(args.roomInspectionId, {
      notes: args.notes,
    });
  },
});

export const complete = mutation({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    const { roomInspection } = await requireRoomInspectionAccess(
      ctx,
      args.roomInspectionId
    );

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    if (photos.length < roomInspection.requiredPhotoMin) {
      throw new Error(
        `At least ${roomInspection.requiredPhotoMin} photo(s) are required before completion`
      );
    }

    const taskResults = await ctx.db
      .query("taskResults")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    if (taskResults.some((task) => !task.completed)) {
      throw new Error("All tasks in this room must be completed first");
    }

    await ctx.db.patch(args.roomInspectionId, {
      status: "COMPLETED",
      completedAt: Date.now(),
    });
  },
});

