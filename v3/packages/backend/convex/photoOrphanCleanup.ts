import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getPhotoOrphanCutoff,
  normalizeRetentionBatchSize,
  normalizeRetentionMaxBatches,
  PHOTO_ORPHAN_GRACE_DAYS,
  type PhotoOrphanAuditBatchResult,
  type PhotoOrphanCandidate,
  type PhotoOrphanDeleteBatchResult,
  type PhotoOrphanPurgeResult,
} from "./lib/photoRetention";

const orphanCandidateValidator = v.object({
  storageId: v.id("_storage"),
  size: v.number(),
});

export const findOrphanedStorageBatchInternal = internalQuery({
  args: {
    cutoff: v.number(),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PhotoOrphanAuditBatchResult> => {
    const batchSize = normalizeRetentionBatchSize(args.batchSize);
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", args.cutoff))
      .order("asc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: batchSize,
      });

    const candidates = (
      await Promise.all(
        page.page.map(async (storedFile): Promise<PhotoOrphanCandidate | null> => {
          const photo = await ctx.db
            .query("photos")
            .withIndex("by_storage_id", (q) => q.eq("storageId", storedFile._id))
            .first();
          return photo
            ? null
            : {
                storageId: storedFile._id,
                size: storedFile.size,
              };
        })
      )
    ).filter((candidate): candidate is PhotoOrphanCandidate => candidate !== null);

    return {
      candidates,
      checkedObjects: page.page.length,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const deleteOrphanedStorageBatchInternal = internalMutation({
  args: {
    cutoff: v.number(),
    candidates: v.array(orphanCandidateValidator),
  },
  handler: async (ctx, args): Promise<PhotoOrphanDeleteBatchResult> => {
    let deletedObjects = 0;
    let deletedBytes = 0;
    let skippedObjects = 0;
    let failedObjects = 0;

    for (const candidate of args.candidates) {
      const storedFile = await ctx.db.system.get("_storage", candidate.storageId);
      if (!storedFile || storedFile._creationTime >= args.cutoff) {
        skippedObjects += 1;
        continue;
      }

      const photo = await ctx.db
        .query("photos")
        .withIndex("by_storage_id", (q) => q.eq("storageId", candidate.storageId))
        .first();
      if (photo) {
        skippedObjects += 1;
        continue;
      }

      try {
        await ctx.storage.delete(candidate.storageId);
        deletedObjects += 1;
        deletedBytes += storedFile.size;
      } catch {
        failedObjects += 1;
      }
    }

    return {
      deletedObjects,
      deletedBytes,
      skippedObjects,
      failedObjects,
    };
  },
});

export const purgeOrphanedPhotoFilesInternal = internalAction({
  args: {
    now: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxBatches: v.optional(v.number()),
    trigger: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PhotoOrphanPurgeResult> => {
    const startedAt = Date.now();
    const cutoff = getPhotoOrphanCutoff(args.now ?? startedAt);
    const batchSize = normalizeRetentionBatchSize(args.batchSize);
    const maxBatches = normalizeRetentionMaxBatches(args.maxBatches);
    const candidatesById = new Map<Id<"_storage">, PhotoOrphanCandidate>();
    let cursor: string | undefined;
    let batchesRun = 0;
    let checkedObjects = 0;
    let scanComplete = false;

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const result: PhotoOrphanAuditBatchResult = await ctx.runQuery(
        internal.photoOrphanCleanup.findOrphanedStorageBatchInternal,
        {
          cutoff,
          cursor,
          batchSize,
        }
      );
      batchesRun += 1;
      checkedObjects += result.checkedObjects;
      for (const candidate of result.candidates) {
        candidatesById.set(candidate.storageId, candidate);
      }

      if (result.isDone) {
        scanComplete = true;
        break;
      }
      cursor = result.continueCursor;
    }

    if (!scanComplete) {
      return {
        trigger: args.trigger ?? "manual",
        graceDays: PHOTO_ORPHAN_GRACE_DAYS,
        cutoff,
        cutoffIso: new Date(cutoff).toISOString(),
        batchSize,
        maxBatches,
        batchesRun,
        checkedObjects,
        candidateObjects: candidatesById.size,
        deletedObjects: 0,
        deletedBytes: 0,
        skippedObjects: 0,
        failedObjects: 0,
        incomplete: true,
        startedAt,
        finishedAt: Date.now(),
      };
    }

    let deletedObjects = 0;
    let deletedBytes = 0;
    let skippedObjects = 0;
    let failedObjects = 0;
    const candidates = [...candidatesById.values()];

    for (let offset = 0; offset < candidates.length; offset += batchSize) {
      const result: PhotoOrphanDeleteBatchResult = await ctx.runMutation(
        internal.photoOrphanCleanup.deleteOrphanedStorageBatchInternal,
        {
          cutoff,
          candidates: candidates.slice(offset, offset + batchSize),
        }
      );
      deletedObjects += result.deletedObjects;
      deletedBytes += result.deletedBytes;
      skippedObjects += result.skippedObjects;
      failedObjects += result.failedObjects;
    }

    return {
      trigger: args.trigger ?? "manual",
      graceDays: PHOTO_ORPHAN_GRACE_DAYS,
      cutoff,
      cutoffIso: new Date(cutoff).toISOString(),
      batchSize,
      maxBatches,
      batchesRun,
      checkedObjects,
      candidateObjects: candidates.length,
      deletedObjects,
      deletedBytes,
      skippedObjects,
      failedObjects,
      incomplete: failedObjects > 0,
      startedAt,
      finishedAt: Date.now(),
    };
  },
});
