import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireInspectionAccess, requireRoomInspectionAccess } from "./lib/permissions";
import { photoKindValidator } from "./lib/validators";

async function reopenRoomInspectionIfInvalid(
  ctx: MutationCtx,
  roomInspectionId: Id<"roomInspections">
) {
  const roomInspection = await ctx.db.get(roomInspectionId);
  if (!roomInspection || roomInspection.status !== "COMPLETED") {
    return;
  }

  const photos = await ctx.db
    .query("photos")
    .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspection._id))
    .collect();

  if (photos.length < roomInspection.requiredPhotoMin) {
    await ctx.db.patch(roomInspection._id, {
      status: "PENDING",
      completedAt: undefined,
    });
  }
}

export const generateUploadUrl = mutation({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    await requireRoomInspectionAccess(ctx, args.roomInspectionId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    roomInspectionId: v.id("roomInspections"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    kind: v.optional(photoKindValidator),
  },
  handler: async (ctx, args) => {
    const { roomInspection } = await requireRoomInspectionAccess(
      ctx,
      args.roomInspectionId
    );

    return await ctx.db.insert("photos", {
      ...args,
      inspectionId: roomInspection.inspectionId,
    });
  },
});

export const listByRoomInspection = query({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    await requireRoomInspectionAccess(ctx, args.roomInspectionId);

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    return await Promise.all(
      photos.map(async (photo) => {
        const url = await ctx.storage.getUrl(photo.storageId);
        return {
          ...photo,
          url,
        };
      })
    );
  },
});

export const remove = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    const roomInspectionId = photo.roomInspectionId;

    await requireInspectionAccess(ctx, photo.inspectionId);

    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(args.photoId);
    await reopenRoomInspectionIfInvalid(ctx, roomInspectionId);
  },
});

