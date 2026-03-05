export const USER_ROLES = ["ADMIN", "CLEANER", "INSPECTOR"] as const;
export const FIELD_ROLES = ["CLEANER", "INSPECTOR"] as const;

export const CHECKLIST_TYPES = ["CLEANING", "INSPECTION"] as const;

export const PROPERTY_TYPES = ["RESIDENTIAL", "COMMERCIAL"] as const;

export const INSPECTION_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;
export const ROOM_INSPECTION_STATUSES = ["PENDING", "COMPLETED"] as const;

export const PHOTO_KINDS = [
  "BEFORE",
  "AFTER",
  "ISSUE",
  "GENERAL",
] as const;

export const SERVICE_PLAN_TYPES = [
  "CLEANING",
  "INSPECTION",
  "DEEP_CLEAN",
  "MAINTENANCE",
] as const;

export const SERVICE_PLAN_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "CUSTOM_RRULE",
] as const;

export const JOB_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "BLOCKED",
] as const;

export const JOB_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

