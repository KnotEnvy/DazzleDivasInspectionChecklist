import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  getPhotoRetentionCutoff,
  normalizeRetentionBatchSize,
  normalizeRetentionMaxBatches,
  type PhotoRetentionBatchResult,
  type PhotoRetentionPurgeResult,
  PHOTO_RETENTION_DAYS,
} from "./lib/photoRetention";

export const purgeExpiredPhotosInternal = internalAction({
  args: {
    now: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxBatches: v.optional(v.number()),
    trigger: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PhotoRetentionPurgeResult> => {
    const startedAt = Date.now();
    const cutoff = getPhotoRetentionCutoff(args.now ?? startedAt);
    const batchSize = normalizeRetentionBatchSize(args.batchSize);
    const maxBatches = normalizeRetentionMaxBatches(args.maxBatches);

    let batchesRun = 0;
    let deletedPhotos = 0;
    let deletedBytes = 0;
    let failedPhotos = 0;
    let affectedRoomInspections = 0;
    let hasMore = false;

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const result: PhotoRetentionBatchResult = await ctx.runMutation(
        internal.photoRetentionBatches.purgeExpiredPhotosBatchInternal,
        {
          cutoff,
          batchSize,
        }
      );

      batchesRun += 1;
      deletedPhotos += result.deletedPhotos;
      deletedBytes += result.deletedBytes;
      failedPhotos += result.failedPhotos;
      affectedRoomInspections += result.affectedRoomInspections;
      hasMore = result.hasMore;

      if (!result.hasMore || result.failedPhotos > 0) {
        break;
      }
    }

    return {
      trigger: args.trigger ?? "manual",
      retentionDays: PHOTO_RETENTION_DAYS,
      cutoff,
      cutoffIso: new Date(cutoff).toISOString(),
      batchSize,
      maxBatches,
      batchesRun,
      deletedPhotos,
      deletedBytes,
      failedPhotos,
      affectedRoomInspections,
      incomplete: hasMore || failedPhotos > 0,
      stoppedForFailures: failedPhotos > 0,
      startedAt,
      finishedAt: Date.now(),
    };
  },
});
