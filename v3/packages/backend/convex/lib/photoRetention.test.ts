import { describe, expect, it } from "vitest";
import {
  getPhotoOrphanCutoff,
  getPhotoRetentionCutoff,
  normalizeRetentionBatchSize,
  normalizeRetentionMaxBatches,
  PHOTO_ORPHAN_DAILY_SCHEDULE,
  PHOTO_ORPHAN_GRACE_DAYS,
  PHOTO_RETENTION_BATCH_SIZE,
  PHOTO_RETENTION_DAILY_SCHEDULE,
  PHOTO_RETENTION_DAYS,
  PHOTO_RETENTION_MAX_BATCHES,
} from "./photoRetention";

describe("getPhotoRetentionCutoff", () => {
  it("returns the exact 60-day cutoff for expired photos", () => {
    const now = Date.UTC(2026, 6, 4, 12, 0, 0);
    const cutoff = Date.UTC(2026, 4, 5, 12, 0, 0);

    expect(PHOTO_RETENTION_DAYS).toBe(60);
    expect(getPhotoRetentionCutoff(now)).toBe(cutoff);
  });

  it("keeps recent unreferenced uploads inside the orphan grace period", () => {
    const now = Date.UTC(2026, 6, 4, 12, 0, 0);
    const cutoff = Date.UTC(2026, 5, 27, 12, 0, 0);

    expect(PHOTO_ORPHAN_GRACE_DAYS).toBe(7);
    expect(getPhotoOrphanCutoff(now)).toBe(cutoff);
  });

  it("runs retention and orphan cleanup every day at separate UTC times", () => {
    expect(PHOTO_RETENTION_DAILY_SCHEDULE).toEqual({ hourUTC: 6, minuteUTC: 0 });
    expect(PHOTO_ORPHAN_DAILY_SCHEDULE).toEqual({ hourUTC: 6, minuteUTC: 30 });
  });
});

describe("retention batch normalization", () => {
  it("uses bounded integer defaults for purge batches", () => {
    expect(normalizeRetentionBatchSize()).toBe(PHOTO_RETENTION_BATCH_SIZE);
    expect(normalizeRetentionBatchSize(0)).toBe(1);
    expect(normalizeRetentionBatchSize(12.9)).toBe(12);
    expect(normalizeRetentionBatchSize(1000)).toBe(500);

    expect(normalizeRetentionMaxBatches()).toBe(PHOTO_RETENTION_MAX_BATCHES);
    expect(normalizeRetentionMaxBatches(Number.NaN)).toBe(1);
    expect(normalizeRetentionMaxBatches(300)).toBe(250);
  });
});
