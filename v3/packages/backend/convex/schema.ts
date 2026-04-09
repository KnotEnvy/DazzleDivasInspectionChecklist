import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { propertyChecklistOverrideValidator } from "./lib/checklistTemplates";

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
    createdAt: v.optional(v.number()),
    createdById: v.optional(v.id("users")),
    provisionedByAdmin: v.optional(v.boolean()),
    passwordSetupStatus: v.optional(
      v.union(
        v.literal("SELF_SIGNUP"),
        v.literal("ADMIN_BOOTSTRAP"),
        v.literal("INVITED"),
        v.literal("PASSWORD_SET")
      )
    ),
    inviteSentAt: v.optional(v.number()),
    inviteDeliveryError: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  userAdminEvents: defineTable({
    actorId: v.id("users"),
    targetUserId: v.id("users"),
    eventType: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_target_user", ["targetUserId", "createdAt"])
    .index("by_created_at", ["createdAt"]),

  properties: defineTable({
    name: v.string(),
    address: v.string(),
    clientLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    propertyType: v.union(v.literal("RESIDENTIAL"), v.literal("COMMERCIAL")),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accessInstructions: v.optional(v.string()),
    entryMethod: v.optional(v.string()),
    serviceNotes: v.optional(v.string()),
    activeCleanerAssignments: v.optional(v.number()),
    activeInspectorAssignments: v.optional(v.number()),
    activeServicePlans: v.optional(v.number()),
    checklistOverrides: v.optional(propertyChecklistOverrideValidator),
    isArchived: v.optional(v.boolean()),
    isActive: v.boolean(),
  })
    .index("by_active", ["isActive"])
    .index("by_archived", ["isArchived"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_address", { searchField: "address" }),

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

  servicePlans: defineTable({
    propertyId: v.id("properties"),
    planType: v.union(
      v.literal("CLEANING"),
      v.literal("INSPECTION"),
      v.literal("DEEP_CLEAN"),
      v.literal("MAINTENANCE")
    ),
    frequency: v.union(
      v.literal("DAILY"),
      v.literal("WEEKLY"),
      v.literal("BIWEEKLY"),
      v.literal("MONTHLY"),
      v.literal("CUSTOM_RRULE")
    ),
    daysOfWeek: v.optional(v.array(v.number())),
    timeWindowStart: v.string(),
    timeWindowEnd: v.string(),
    defaultDurationMinutes: v.number(),
    defaultAssigneeRole: v.union(v.literal("CLEANER"), v.literal("INSPECTOR")),
    defaultAssigneeId: v.optional(v.id("users")),
    priority: v.optional(
      v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("URGENT"))
    ),
    notes: v.optional(v.string()),
    customRrule: v.optional(v.string()),
    anchorDate: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_property", ["propertyId"])
    .index("by_active", ["isActive"])
    .index("by_property_active", ["propertyId", "isActive"]),

  jobs: defineTable({
    propertyId: v.id("properties"),
    servicePlanId: v.optional(v.id("servicePlans")),
    jobType: v.union(
      v.literal("CLEANING"),
      v.literal("INSPECTION"),
      v.literal("DEEP_CLEAN"),
      v.literal("MAINTENANCE")
    ),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    assigneeId: v.optional(v.id("users")),
    status: v.union(
      v.literal("SCHEDULED"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED"),
      v.literal("BLOCKED")
    ),
    priority: v.optional(
      v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("URGENT"))
    ),
    intakeSource: v.optional(
      v.union(
        v.literal("EMAIL"),
        v.literal("TEXT"),
        v.literal("PHONE"),
        v.literal("MANUAL")
      )
    ),
    clientLabel: v.optional(v.string()),
    isBackToBack: v.optional(v.boolean()),
    arrivalDeadline: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdById: v.id("users"),
    completedAt: v.optional(v.number()),
    linkedInspectionId: v.optional(v.id("inspections")),
  })
    .index("by_property", ["propertyId"])
    .index("by_property_start", ["propertyId", "scheduledStart"])
    .index("by_service_plan", ["servicePlanId"])
    .index("by_service_plan_start", ["servicePlanId", "scheduledStart"])
    .index("by_assignee", ["assigneeId"])
    .index("by_assignee_start", ["assigneeId", "scheduledStart"])
    .index("by_assignee_status_start", ["assigneeId", "status", "scheduledStart"])
    .index("by_status_start", ["status", "scheduledStart"])
    .index("by_scheduled_start", ["scheduledStart"])
    .index("by_linked_inspection", ["linkedInspectionId"]),

  jobEvents: defineTable({
    jobId: v.id("jobs"),
    eventType: v.string(),
    actorId: v.id("users"),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_created_at", ["createdAt"]),

  rooms: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    generationMode: v.optional(
      v.union(
        v.literal("SINGLE"),
        v.literal("PER_BEDROOM"),
        v.literal("PER_BATHROOM")
      )
    ),
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
    issueCount: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sourceInspectionId: v.optional(v.id("inspections")),
  })
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_property", ["propertyId"])
    .index("by_status", ["status"])
    .index("by_type_status", ["type", "status"]),

  roomInspections: defineTable({
    inspectionId: v.id("inspections"),
    roomId: v.optional(v.id("rooms")),
    roomName: v.string(),
    status: v.union(v.literal("PENDING"), v.literal("COMPLETED")),
    notes: v.optional(v.string()),
    totalTasks: v.optional(v.number()),
    completedTasks: v.optional(v.number()),
    issueCount: v.optional(v.number()),
    photoCount: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    requiredPhotoMin: v.number(),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_room", ["roomId"]),

  taskResults: defineTable({
    taskId: v.optional(v.id("tasks")),
    inspectionId: v.optional(v.id("inspections")),
    roomInspectionId: v.id("roomInspections"),
    taskDescription: v.string(),
    completed: v.boolean(),
    hasIssue: v.optional(v.boolean()),
    issueNotes: v.optional(v.string()),
  })
    .index("by_room_inspection", ["roomInspectionId"])
    .index("by_inspection", ["inspectionId"])
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


  financePropertyConfigs: defineTable({
    propertyId: v.id("properties"),
    cleaningRevenuePerJob: v.number(),
    roomComboUnits: v.number(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
    updatedById: v.id("users"),
  }).index("by_property", ["propertyId"]),

  workerPayProfiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("CLEANER"), v.literal("INSPECTOR")),
    perRoomComboRate: v.number(),
    unitBonus: v.number(),
    effectiveStart: v.number(),
    effectiveEnd: v.optional(v.number()),
    isActive: v.boolean(),
    updatedAt: v.number(),
    updatedById: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_user_role_active", ["userId", "role", "isActive"]),

  jobFinancials: defineTable({
    jobId: v.id("jobs"),
    inspectionId: v.optional(v.id("inspections")),
    propertyId: v.id("properties"),
    assigneeId: v.optional(v.id("users")),
    jobType: v.union(
      v.literal("CLEANING"),
      v.literal("INSPECTION"),
      v.literal("DEEP_CLEAN"),
      v.literal("MAINTENANCE")
    ),
    financialScope: v.literal("CLEANING"),
    revenueAmountSnapshot: v.optional(v.number()),
    roomComboUnitsSnapshot: v.optional(v.number()),
    perRoomComboRateSnapshot: v.optional(v.number()),
    unitBonusSnapshot: v.optional(v.number()),
    payrollAmountSnapshot: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    status: v.union(v.literal("DRAFT"), v.literal("PENDING_REVIEW"), v.literal("APPROVED")),
    approvedAt: v.optional(v.number()),
    approvedById: v.optional(v.id("users")),
    unlockedAt: v.optional(v.number()),
    unlockedById: v.optional(v.id("users")),
    unlockReason: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_inspection", ["inspectionId"])
    .index("by_status", ["status"])
    .index("by_property", ["propertyId"])
    .index("by_assignee", ["assigneeId"]),

  financeEvents: defineTable({
    jobFinancialId: v.id("jobFinancials"),
    jobId: v.id("jobs"),
    actorId: v.id("users"),
    eventType: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_job_financial", ["jobFinancialId"])
    .index("by_job", ["jobId"]),
});

export default schema;


