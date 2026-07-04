import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { PHOTO_RETENTION_MONTHLY_SCHEDULE } from "./lib/photoRetention";

const crons = cronJobs();

crons.monthly(
  "purge photos older than 90 days",
  PHOTO_RETENTION_MONTHLY_SCHEDULE,
  internal.photoRetention.purgeExpiredPhotosInternal,
  {
    trigger: "monthly-cron",
  }
);

export default crons;
