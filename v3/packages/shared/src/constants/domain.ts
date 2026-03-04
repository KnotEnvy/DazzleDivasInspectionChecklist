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

