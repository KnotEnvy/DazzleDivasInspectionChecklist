import type {
  USER_ROLES,
  FIELD_ROLES,
  CHECKLIST_TYPES,
  PROPERTY_TYPES,
  INSPECTION_STATUSES,
  ROOM_INSPECTION_STATUSES,
  PHOTO_KINDS,
  SERVICE_PLAN_TYPES,
  SERVICE_PLAN_FREQUENCIES,
  JOB_STATUSES,
  JOB_PRIORITIES,
} from "../constants/domain";

export type UserRole = (typeof USER_ROLES)[number];
export type FieldRole = (typeof FIELD_ROLES)[number];

export type ChecklistType = (typeof CHECKLIST_TYPES)[number];

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type RoomInspectionStatus = (typeof ROOM_INSPECTION_STATUSES)[number];

export type PhotoKind = (typeof PHOTO_KINDS)[number];
export type ServicePlanType = (typeof SERVICE_PLAN_TYPES)[number];
export type ServicePlanFrequency = (typeof SERVICE_PLAN_FREQUENCIES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export interface ChecklistTemplateTask {
  description: string;
  sortOrder: number;
  requiredPhotoKind?: PhotoKind;
}

