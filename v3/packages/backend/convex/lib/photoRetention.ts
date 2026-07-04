export const PHOTO_RETENTION_DAYS = 90;
export const PHOTO_RETENTION_BATCH_SIZE = 100;
export const PHOTO_RETENTION_MAX_BATCHES = 100;
export const PHOTO_RETENTION_MANUAL_PURGE_TOKEN_ENV = "PHOTO_RETENTION_PURGE_TOKEN";

export type PhotoRetentionBatchResult = {
  cutoff: number;
  batchSize: number;
  checkedPhotos: number;
  deletedPhotos: number;
  deletedBytes: number;
  failedPhotos: number;
  affectedRoomInspections: number;
  hasMore: boolean;
};

export type PhotoRetentionPurgeResult = {
  trigger: string;
  retentionDays: number;
  cutoff: number;
  cutoffIso: string;
  batchSize: number;
  maxBatches: number;
  batchesRun: number;
  deletedPhotos: number;
  deletedBytes: number;
  failedPhotos: number;
  affectedRoomInspections: number;
  incomplete: boolean;
  stoppedForFailures: boolean;
  startedAt: number;
  finishedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH_SIZE = 500;
const MAX_BATCHES = 250;

export const PHOTO_RETENTION_MONTHLY_SCHEDULE = {
  day: 1,
  hourUTC: 6,
  minuteUTC: 0,
} as const;

export function getPhotoRetentionCutoff(now = Date.now()) {
  return now - PHOTO_RETENTION_DAYS * DAY_MS;
}

export function normalizeRetentionBatchSize(batchSize?: number) {
  if (batchSize === undefined) {
    return PHOTO_RETENTION_BATCH_SIZE;
  }

  return clampInteger(batchSize, 1, MAX_BATCH_SIZE);
}

export function normalizeRetentionMaxBatches(maxBatches?: number) {
  if (maxBatches === undefined) {
    return PHOTO_RETENTION_MAX_BATCHES;
  }

  return clampInteger(maxBatches, 1, MAX_BATCHES);
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}
