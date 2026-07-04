import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { adjustRoomInspectionMetrics } from "./lib/inspectionMetrics";
import { normalizeRetentionBatchSize } from "./lib/photoRetention";

export const purgeExpiredPhotosBatchInternal = internalMutation({
  args: {
    cutoff: v.number(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = normalizeRetentionBatchSize(args.batchSize);
    const expiredPhotos = await ctx.db
      .query("photos")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", args.cutoff))
      .take(batchSize);

    let deletedPhotos = 0;
    let deletedBytes = 0;
    let failedPhotos = 0;
    const affectedRoomInspectionIds = new Set<Id<"roomInspections">>();

    for (const photo of expiredPhotos) {
      try {
        await ctx.storage.delete(photo.storageId);
        await ctx.db.delete(photo._id);
        affectedRoomInspectionIds.add(photo.roomInspectionId);
        deletedPhotos += 1;
        deletedBytes += photo.fileSize;
      } catch {
        failedPhotos += 1;
      }
    }

    for (const roomInspectionId of affectedRoomInspectionIds) {
      await adjustRoomInspectionMetrics(ctx, roomInspectionId, {
        photoCount: 0,
      });
    }

    return {
      cutoff: args.cutoff,
      batchSize,
      checkedPhotos: expiredPhotos.length,
      deletedPhotos,
      deletedBytes,
      failedPhotos,
      affectedRoomInspections: affectedRoomInspectionIds.size,
      hasMore:
        failedPhotos === 0 &&
        expiredPhotos.length === batchSize &&
        deletedPhotos === expiredPhotos.length,
    };
  },
});
