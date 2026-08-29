import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import {
  PHOTO_ORPHAN_DAILY_SCHEDULE,
  PHOTO_RETENTION_DAILY_SCHEDULE,
} from "./lib/photoRetention";

const crons = cronJobs();

crons.daily(
  "purge photos older than 60 days",
  PHOTO_RETENTION_DAILY_SCHEDULE,
  internal.photoRetention.purgeExpiredPhotosInternal,
  {
    trigger: "daily-cron",
  }
);

crons.daily(
  "purge orphaned photo files",
  PHOTO_ORPHAN_DAILY_SCHEDULE,
  internal.photoOrphanCleanup.purgeOrphanedPhotoFilesInternal,
  {
    trigger: "daily-cron",
  }
);

export default crons;
