import { v } from "convex/values";
import { CHECKLIST_TYPES } from "@dazzle/shared";

export const userRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("CLEANER"),
  v.literal("INSPECTOR")
);

export const assignmentRoleValidator = v.union(
  v.literal("CLEANER"),
  v.literal("INSPECTOR")
);

export const checklistTypeValidator = v.union(
  v.literal("CLEANING"),
  v.literal("INSPECTION")
);

export const propertyTypeValidator = v.union(
  v.literal("RESIDENTIAL"),
  v.literal("COMMERCIAL")
);

export const inspectionStatusValidator = v.union(
  v.literal("IN_PROGRESS"),
  v.literal("COMPLETED")
);

export const roomStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("COMPLETED")
);

export const photoKindValidator = v.union(
  v.literal("BEFORE"),
  v.literal("AFTER"),
  v.literal("ISSUE"),
  v.literal("GENERAL")
);

export function assignmentRoleForChecklistType(type: "CLEANING" | "INSPECTION") {
  return type === "CLEANING" ? "CLEANER" : "INSPECTOR";
}

export function assertChecklistType(value: string): asserts value is "CLEANING" | "INSPECTION" {
  if (!CHECKLIST_TYPES.includes(value as "CLEANING" | "INSPECTION")) {
    throw new Error(`Unsupported checklist type: ${value}`);
  }
}

