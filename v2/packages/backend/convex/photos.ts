import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/permissions";

/**
 * Generate an upload URL for a photo.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save photo metadata after upload.
 */
export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    roomInspectionId: v.id("roomInspections"),
    inspectionId: v.id("inspections"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.insert("photos", args);
  },
});

/**
 * Get the URL for a stored photo.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * List photos for a room inspection.
 */
export const listByRoomInspection = query({
  args: { roomInspectionId: v.id("roomInspections") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) =>
        q.eq("roomInspectionId", args.roomInspectionId)
      )
      .collect();

    return await Promise.all(
      photos.map(async (photo) => {
        const url = await ctx.storage.getUrl(photo.storageId);
        return { ...photo, url, originalUrl: url };
      })
    );
  },
});

/**
 * Delete a photo and its storage file.
 */
export const remove = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const photo = await ctx.db.get(args.photoId);
    if (!photo) throw new Error("Photo not found");

    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(args.photoId);
  },
});
