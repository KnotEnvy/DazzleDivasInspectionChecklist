import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  requireAuth,
  requireInspectionAccess,
  assertPropertyAccessForChecklist,
} from "./lib/permissions";
import {
  assertAllRoomsCompleted,
  validateChecklistStartFromJob,
} from "./lib/jobLifecycle";
import {
  deriveRoomNames,
  loadEffectivePropertyTemplateRooms,
} from "./lib/checklistTemplates";
import {
  assignmentRoleForChecklistType,
  checklistTypeValidator,
  checklistTypeForJobType,
} from "./lib/validators";

async function ensureAssigneeIsEligible(
  ctx: MutationCtx,
  assigneeId: Id<"users">,
  propertyId: Id<"properties">,
  checklistType: "CLEANING" | "INSPECTION",
  options?: {
    skipPropertyAssignmentCheck?: boolean;
  }
): Promise<Doc<"users">> {
  const assignee = await ctx.db.get(assigneeId);
  if (!assignee) {
    throw new Error("Assignee not found");
  }

  const requiredRole = assignmentRoleForChecklistType(checklistType);

  if (assignee.role !== requiredRole) {
    throw new Error(`Assignee must have role ${requiredRole}`);
  }

  if (!assignee.isActive) {
    throw new Error("Assignee account is deactivated");
  }

  if (!options?.skipPropertyAssignmentCheck) {
    const assignment = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property_user_role_active", (q) =>
        q
          .eq("propertyId", propertyId)
          .eq("userId", assigneeId)
          .eq("assignmentRole", requiredRole)
          .eq("isActive", true)
      )
      .unique();

    if (!assignment) {
      throw new Error("Assignee is not assigned to this property for this checklist type");
    }
  }

  return assignee;
}

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return await ctx.db
        .query("inspections")
        .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
        .collect();
    }

    return await ctx.db
      .query("inspections")
      .withIndex("by_assignee_status", (q) =>
        q.eq("assigneeId", user._id).eq("status", "IN_PROGRESS")
      )
      .collect();
  },
});

export const listCompleted = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const inspections =
      user.role === "ADMIN"
        ? await ctx.db
            .query("inspections")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
            .order("desc")
            .collect()
        : await ctx.db
            .query("inspections")
            .withIndex("by_assignee_status", (q) =>
              q.eq("assigneeId", user._id).eq("status", "COMPLETED")
            )
            .order("desc")
            .collect();

    return await Promise.all(
      inspections.map(async (inspection) => {
        const roomInspections = await ctx.db
          .query("roomInspections")
          .withIndex("by_inspection", (q) => q.eq("inspectionId", inspection._id))
          .collect();

        const roomIssueCounts = await Promise.all(
          roomInspections.map(async (roomInspection) => {
            const taskResults = await ctx.db
              .query("taskResults")
              .withIndex("by_room_inspection", (q) =>
                q.eq("roomInspectionId", roomInspection._id)
              )
              .collect();

            return taskResults.filter((task) => task.hasIssue).length;
          })
        );

        return {
          ...inspection,
          issueCount: roomIssueCounts.reduce((sum, count) => sum + count, 0),
        };
      })
    );
  },
});

export const getById = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, args) => {
    const { inspection } = await requireInspectionAccess(ctx, args.inspectionId);

    const roomInspections = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    const roomsWithProgress = await Promise.all(
      roomInspections.map(async (roomInspection) => {
        const taskResults = await ctx.db
          .query("taskResults")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", roomInspection._id)
          )
          .collect();

        const photos = await ctx.db
          .query("photos")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", roomInspection._id)
          )
          .collect();

        return {
          ...roomInspection,
          totalTasks: taskResults.length,
          completedTasks: taskResults.filter((task) => task.completed).length,
          issueCount: taskResults.filter((task) => task.hasIssue).length,
          photoCount: photos.length,
        };
      })
    );

    return {
      ...inspection,
      roomInspections: roomsWithProgress,
    };
  },
});

export const create = mutation({
  args: {
    propertyId: v.id("properties"),
    type: checklistTypeValidator,
    assigneeId: v.optional(v.id("users")),
    sourceInspectionId: v.optional(v.id("inspections")),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuth(ctx);
    const job = args.jobId ? await ctx.db.get(args.jobId) : null;
    const existingInspection = job?.linkedInspectionId
      ? await ctx.db.get(job.linkedInspectionId)
      : null;
    const lifecycleDecision = validateChecklistStartFromJob({
      jobIdProvided: !!args.jobId,
      job: job
        ? {
            propertyId: job.propertyId,
            status: job.status,
            jobType: job.jobType,
            linkedInspectionId: job.linkedInspectionId,
            assigneeId: job.assigneeId,
          }
        : null,
      propertyId: args.propertyId,
      checklistType: args.type,
      actor: {
        _id: actor._id,
        role: actor.role,
      },
      existingInspectionExists: !!existingInspection,
    });

    if (lifecycleDecision.existingInspectionId && existingInspection) {
      return existingInspection._id;
    }

    const property = await ctx.db.get(args.propertyId);

    if (!property || !property.isActive || property.isArchived === true) {
      throw new Error("Property not found or inactive");
    }

    const assigneeId = args.assigneeId ?? lifecycleDecision.nextAssigneeId ?? actor._id;

    if (actor.role !== "ADMIN" && assigneeId !== actor._id) {
      throw new Error("Only admins can create inspections for other users");
    }

    if (actor.role !== "ADMIN" && !lifecycleDecision.isAssignedWorkerForLinkedJob) {
      await assertPropertyAccessForChecklist(ctx, actor, args.propertyId, args.type);
    }

    const assignee = await ensureAssigneeIsEligible(
      ctx,
      assigneeId,
      args.propertyId,
      args.type,
      {
        skipPropertyAssignmentCheck: lifecycleDecision.skipPropertyAssignmentCheck,
      }
    );

    const inspectionId = await ctx.db.insert("inspections", {
      propertyId: args.propertyId,
      propertyName: property.name,
      type: args.type,
      assigneeId,
      assigneeName: assignee.name,
      createdById: actor._id,
      status: "IN_PROGRESS",
      sourceInspectionId: args.sourceInspectionId,
    });

    const templateLibrary = await loadEffectivePropertyTemplateRooms(ctx, args.propertyId, {
      checklistType: args.type,
      includeInactive: false,
    });

    for (const room of templateLibrary.rooms) {
      const tasks = room.tasks;
      if (tasks.length === 0) {
        continue;
      }

      const derivedRoomNames = deriveRoomNames({
        room,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      });

      for (const roomName of derivedRoomNames) {
        const requiredPhotoMin = Math.max(
          2,
          ...tasks.map((task) => task.requiredPhotoMin ?? 0)
        );

        const roomInspectionId = await ctx.db.insert("roomInspections", {
          inspectionId,
          roomId: room.sourceRoomId,
          roomName,
          status: "PENDING",
          requiredPhotoMin,
        });

        for (const task of tasks) {
          await ctx.db.insert("taskResults", {
            taskId: task.sourceTaskId,
            roomInspectionId,
            taskDescription: task.description,
            completed: false,
          });
        }
      }
    }

    if (job) {
      await ctx.db.patch(job._id, {
        linkedInspectionId: inspectionId,
        assigneeId,
        status: "IN_PROGRESS",
      });

      await ctx.db.insert("jobEvents", {
        jobId: job._id,
        eventType: "CHECKLIST_STARTED",
        actorId: actor._id,
        metadata: JSON.stringify({
          inspectionId,
          checklistType: args.type,
        }),
        createdAt: Date.now(),
      });
    }

    return inspectionId;
  },
});

export const complete = mutation({
  args: {
    inspectionId: v.id("inspections"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { inspection, user } = await requireInspectionAccess(ctx, args.inspectionId);

    if (inspection.status === "COMPLETED") {
      return;
    }

    const rooms = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    assertAllRoomsCompleted(rooms);

    const completedAt = Date.now();
    await ctx.db.patch(args.inspectionId, {
      status: "COMPLETED",
      completedAt,
      notes: args.notes,
    });

    const linkedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_linked_inspection", (q) =>
        q.eq("linkedInspectionId", args.inspectionId)
      )
      .collect();

    for (const job of linkedJobs) {
      await ctx.db.patch(job._id, {
        status: "COMPLETED",
        completedAt,
      });

      await ctx.db.insert("jobEvents", {
        jobId: job._id,
        eventType: "CHECKLIST_COMPLETED",
        actorId: user._id,
        metadata: JSON.stringify({
          inspectionId: args.inspectionId,
        }),
        createdAt: completedAt,
      });
    }
  },
});

export const getFullReport = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, args) => {
    const { inspection } = await requireInspectionAccess(ctx, args.inspectionId);

    const property = await ctx.db.get(inspection.propertyId);

    const roomInspections = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    const rooms = await Promise.all(
      roomInspections.map(async (roomInspection) => {
        const tasks = await ctx.db
          .query("taskResults")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", roomInspection._id)
          )
          .collect();

        const photos = await ctx.db
          .query("photos")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", roomInspection._id)
          )
          .collect();

        return {
          room_name: roomInspection.roomName,
          status: roomInspection.status,
          notes: roomInspection.notes ?? null,
          required_photo_min: roomInspection.requiredPhotoMin,
          photo_count: photos.length,
          tasks: tasks.map((task) => ({
            description: task.taskDescription,
            completed: task.completed,
            has_issue: task.hasIssue ?? false,
            issue_notes: task.issueNotes ?? null,
          })),
        };
      })
    );

    return {
      property_name: inspection.propertyName,
      property_address: property?.address ?? "",
      checklist_type: inspection.type,
      assignee_name: inspection.assigneeName,
      inspection_date: inspection.completedAt
        ? new Date(inspection.completedAt).toISOString()
        : new Date(inspection._creationTime).toISOString(),
      status: inspection.status,
      notes: inspection.notes ?? null,
      rooms,
    };
  },
});

