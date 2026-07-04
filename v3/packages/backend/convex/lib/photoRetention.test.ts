import { describe, expect, it } from "vitest";
import {
  getPhotoRetentionCutoff,
  normalizeRetentionBatchSize,
  normalizeRetentionMaxBatches,
  PHOTO_RETENTION_BATCH_SIZE,
  PHOTO_RETENTION_DAYS,
  PHOTO_RETENTION_MAX_BATCHES,
} from "./photoRetention";

describe("getPhotoRetentionCutoff", () => {
  it("returns the exact 90-day cutoff for expired photos", () => {
    const now = Date.UTC(2026, 6, 4, 12, 0, 0);
    const cutoff = Date.UTC(2026, 3, 5, 12, 0, 0);

    expect(PHOTO_RETENTION_DAYS).toBe(90);
    expect(getPhotoRetentionCutoff(now)).toBe(cutoff);
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
