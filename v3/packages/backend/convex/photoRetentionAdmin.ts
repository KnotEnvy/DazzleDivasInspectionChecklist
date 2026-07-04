import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  PHOTO_RETENTION_MANUAL_PURGE_TOKEN_ENV,
  type PhotoRetentionPurgeResult,
} from "./lib/photoRetention";

export const purgeExpiredPhotosNow = action({
  args: {
    token: v.string(),
    batchSize: v.optional(v.number()),
    maxBatches: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PhotoRetentionPurgeResult> => {
    const expectedToken = process.env[PHOTO_RETENTION_MANUAL_PURGE_TOKEN_ENV];

    if (!expectedToken || args.token !== expectedToken) {
      throw new Error("Manual photo retention purge token is missing or invalid");
    }

    return await ctx.runAction(internal.photoRetention.purgeExpiredPhotosInternal, {
      batchSize: args.batchSize,
      maxBatches: args.maxBatches,
      trigger: "manual-cli",
    });
  },
});
