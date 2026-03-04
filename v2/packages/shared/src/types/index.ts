// ============================================================
// Dazzle Divas Inspection App - Shared Types
// ============================================================

// --- Enums ---

export const UserRole = {
  ADMIN: "ADMIN",
  INSPECTOR: "INSPECTOR",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PropertyType = {
  RESIDENTIAL: "RESIDENTIAL",
  COMMERCIAL: "COMMERCIAL",
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const InspectionStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;
export type InspectionStatus =
  (typeof InspectionStatus)[keyof typeof InspectionStatus];

export const RoomInspectionStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
} as const;
export type RoomInspectionStatus =
  (typeof RoomInspectionStatus)[keyof typeof RoomInspectionStatus];

// --- Entity Types ---

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  _creationTime: number;
}

export interface Property {
  _id: string;
  name: string;
  address: string;
  description?: string;
  propertyType: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  notes?: string;
  isActive: boolean;
  _creationTime: number;
}

export interface PropertyAssignment {
  _id: string;
  propertyId: string;
  inspectorId: string;
  startDate: number;
  endDate?: number;
  isActive: boolean;
  _creationTime: number;
}

export interface Room {
  _id: string;
  name: string;
  description?: string;
  sortOrder: number;
  _creationTime: number;
}

export interface Task {
  _id: string;
  description: string;
  roomId: string;
  sortOrder: number;
  _creationTime: number;
}

export interface Inspection {
  _id: string;
  propertyId: string;
  propertyName: string;
  inspectorId: string;
  inspectorName: string;
  status: InspectionStatus;
  notes?: string;
  completedAt?: number;
  _creationTime: number;
}

export interface RoomInspection {
  _id: string;
  inspectionId: string;
  roomId: string;
  roomName: string;
  status: RoomInspectionStatus;
  notes?: string;
  completedAt?: number;
  _creationTime: number;
}

export interface TaskResult {
  _id: string;
  taskId: string;
  roomInspectionId: string;
  taskDescription: string;
  completed: boolean;
  _creationTime: number;
}

export interface Photo {
  _id: string;
  storageId: string;
  roomInspectionId: string;
  inspectionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  _creationTime: number;
}

// --- Offline Types ---

export const SyncStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  FAILED: "FAILED",
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const SyncAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;
export type SyncAction = (typeof SyncAction)[keyof typeof SyncAction];

export interface SyncQueueItem {
  id: string;
  type: "INSPECTION" | "ROOM" | "TASK" | "PHOTO";
  action: SyncAction;
  data: unknown;
  timestamp: number;
  retries: number;
  status: SyncStatus;
}

// --- Dashboard Types ---

export interface DashboardStats {
  totalProperties: number;
  totalInspectors: number;
  activeInspections: number;
  completedInspections: number;
  recentInspections: Inspection[];
}
