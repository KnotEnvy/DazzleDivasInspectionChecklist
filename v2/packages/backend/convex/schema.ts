import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  // Application users extending auth users
  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    // App-specific fields
    role: v.union(v.literal("ADMIN"), v.literal("INSPECTOR")),
    isActive: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Properties to be inspected
  properties: defineTable({
    name: v.string(),
    address: v.string(),
    description: v.optional(v.string()),
    propertyType: v.union(
      v.literal("RESIDENTIAL"),
      v.literal("COMMERCIAL")
    ),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_active", ["isActive"])
    .searchIndex("search_name", { searchField: "name" }),

  // Inspector-to-property assignments
  propertyAssignments: defineTable({
    propertyId: v.id("properties"),
    inspectorId: v.id("users"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_property", ["propertyId"])
    .index("by_inspector", ["inspectorId"])
    .index("by_property_inspector", ["propertyId", "inspectorId"]),

  // Room templates
  rooms: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_sort_order", ["sortOrder"]),

  // Task templates per room
  tasks: defineTable({
    description: v.string(),
    roomId: v.id("rooms"),
    sortOrder: v.number(),
  }).index("by_room", ["roomId"]),

  // Inspections
  inspections: defineTable({
    propertyId: v.id("properties"),
    propertyName: v.string(), // denormalized
    inspectorId: v.id("users"),
    inspectorName: v.string(), // denormalized
    status: v.union(v.literal("IN_PROGRESS"), v.literal("COMPLETED")),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_inspector", ["inspectorId"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_inspector_status", ["inspectorId", "status"]),

  // Room inspections within an inspection
  roomInspections: defineTable({
    inspectionId: v.id("inspections"),
    roomId: v.id("rooms"),
    roomName: v.string(), // denormalized
    status: v.union(v.literal("PENDING"), v.literal("COMPLETED")),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_room", ["roomId"]),

  // Task results within a room inspection
  taskResults: defineTable({
    taskId: v.id("tasks"),
    roomInspectionId: v.id("roomInspections"),
    taskDescription: v.string(), // denormalized
    completed: v.boolean(),
  })
    .index("by_room_inspection", ["roomInspectionId"])
    .index("by_task", ["taskId"]),

  // Photos attached to room inspections
  photos: defineTable({
    storageId: v.id("_storage"),
    roomInspectionId: v.id("roomInspections"),
    inspectionId: v.id("inspections"), // denormalized for easy querying
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  })
    .index("by_room_inspection", ["roomInspectionId"])
    .index("by_inspection", ["inspectionId"]),
});

export default schema;
