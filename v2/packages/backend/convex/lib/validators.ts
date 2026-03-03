import { v } from "convex/values";

/** Reusable argument validators for Convex functions */

export const userRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("INSPECTOR")
);

export const propertyTypeValidator = v.union(
  v.literal("RESIDENTIAL"),
  v.literal("COMMERCIAL")
);

export const inspectionStatusValidator = v.union(
  v.literal("IN_PROGRESS"),
  v.literal("COMPLETED")
);

export const roomInspectionStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("COMPLETED")
);

export const paginationValidator = {
  paginationOpts: v.object({
    numItems: v.number(),
    cursor: v.union(v.string(), v.null()),
  }),
};
