import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    role: v.union(v.literal("ADMIN"), v.literal("CLEANER"), v.literal("INSPECTOR")),
    isActive: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  properties: defineTable({
    name: v.string(),
    address: v.string(),
    description: v.optional(v.string()),
    propertyType: v.union(v.literal("RESIDENTIAL"), v.literal("COMMERCIAL")),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_active", ["isActive"])
    .searchIndex("search_name", { searchField: "name" }),

  propertyAssignments: defineTable({
    propertyId: v.id("properties"),
    userId: v.id("users"),
    assignmentRole: v.union(v.literal("CLEANER"), v.literal("INSPECTOR")),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_property", ["propertyId"])
    .index("by_user", ["userId"])
    .index("by_property_user_role_active", [
      "propertyId",
      "userId",
      "assignmentRole",
      "isActive",
    ])
    .index("by_user_role_active", ["userId", "assignmentRole", "isActive"]),

  rooms: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  }).index("by_sort_order", ["sortOrder"]),

  tasks: defineTable({
    roomId: v.id("rooms"),
    checklistType: v.union(v.literal("CLEANING"), v.literal("INSPECTION")),
    description: v.string(),
    sortOrder: v.number(),
    requiredPhotoMin: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_type_sort", ["roomId", "checklistType", "sortOrder"]),

  inspections: defineTable({
    propertyId: v.id("properties"),
    propertyName: v.string(),
    type: v.union(v.literal("CLEANING"), v.literal("INSPECTION")),
    assigneeId: v.id("users"),
    assigneeName: v.string(),
    createdById: v.id("users"),
    status: v.union(v.literal("IN_PROGRESS"), v.literal("COMPLETED")),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    sourceInspectionId: v.optional(v.id("inspections")),
  })
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_type_status", ["type", "status"]),

  roomInspections: defineTable({
    inspectionId: v.id("inspections"),
    roomId: v.id("rooms"),
    roomName: v.string(),
    status: v.union(v.literal("PENDING"), v.literal("COMPLETED")),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    requiredPhotoMin: v.number(),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_room", ["roomId"]),

  taskResults: defineTable({
    taskId: v.id("tasks"),
    roomInspectionId: v.id("roomInspections"),
    taskDescription: v.string(),
    completed: v.boolean(),
  })
    .index("by_room_inspection", ["roomInspectionId"])
    .index("by_task", ["taskId"]),

  photos: defineTable({
    storageId: v.id("_storage"),
    roomInspectionId: v.id("roomInspections"),
    inspectionId: v.id("inspections"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    kind: v.optional(
      v.union(
        v.literal("BEFORE"),
        v.literal("AFTER"),
        v.literal("ISSUE"),
        v.literal("GENERAL")
      )
    ),
  })
    .index("by_room_inspection", ["roomInspectionId"])
    .index("by_inspection", ["inspectionId"]),
});

export default schema;

