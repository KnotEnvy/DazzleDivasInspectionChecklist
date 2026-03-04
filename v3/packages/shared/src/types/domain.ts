import type {
  USER_ROLES,
  FIELD_ROLES,
  CHECKLIST_TYPES,
  PROPERTY_TYPES,
  INSPECTION_STATUSES,
  ROOM_INSPECTION_STATUSES,
  PHOTO_KINDS,
} from "../constants/domain";

export type UserRole = (typeof USER_ROLES)[number];
export type FieldRole = (typeof FIELD_ROLES)[number];

export type ChecklistType = (typeof CHECKLIST_TYPES)[number];

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type RoomInspectionStatus = (typeof ROOM_INSPECTION_STATUSES)[number];

export type PhotoKind = (typeof PHOTO_KINDS)[number];

export interface ChecklistTemplateTask {
  description: string;
  sortOrder: number;
  requiredPhotoKind?: PhotoKind;
}

