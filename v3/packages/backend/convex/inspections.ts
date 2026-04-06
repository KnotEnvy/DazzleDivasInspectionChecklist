import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  requireInspectionAccess,
  assertPropertyAccessForChecklist,
} from "./lib/permissions";
import {
  assertAllRoomsCompleted,
  getChecklistActiveLimitBlockReason,
  getMaxActiveChecklistsForRole,
  validateChecklistStartFromJob,
} from "./lib/jobLifecycle";
import {
  deriveRoomNames,
  loadEffectivePropertyTemplateRooms,
} from "./lib/checklistTemplates";
import {
  getRoomInspectionMetrics,
  loadInspectionIssueCount,
  loadInspectionTaskResults,
} from "./lib/inspectionMetrics";
import {
  buildCompletedInspectionHistoryItem,
  buildCompletedInspectionReview,
  buildInspectionReport,
} from "./lib/inspectionReporting";
import {
  assignmentRoleForChecklistType,
  checklistTypeValidator,
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

async function assertActiveInspectionCapacity(
  ctx: MutationCtx,
  assigneeId: Id<"users">,
  assigneeRole: "CLEANER" | "INSPECTOR"
) {
  const activeInspections = await ctx.db
    .query("inspections")
    .withIndex("by_assignee_status", (q) =>
      q.eq("assigneeId", assigneeId).eq("status", "IN_PROGRESS")
    )
    .collect();

  const limit = getMaxActiveChecklistsForRole(assigneeRole);
  if (activeInspections.length < limit) {
    return;
  }

  throw new Error(
    getChecklistActiveLimitBlockReason({
      role: assigneeRole,
      activeCount: activeInspections.length,
    })
  );
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
        return buildCompletedInspectionHistoryItem(
          inspection,
          typeof inspection.issueCount === "number"
            ? inspection.issueCount
            : await loadInspectionIssueCount(ctx, inspection._id)
        );
      })
    );
  },
});

export const listCompletedPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const results =
      user.role === "ADMIN"
        ? await ctx.db
            .query("inspections")
            .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("inspections")
            .withIndex("by_assignee_status", (q) =>
              q.eq("assigneeId", user._id).eq("status", "COMPLETED")
            )
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (inspection) => {
          return buildCompletedInspectionHistoryItem(
            inspection,
            typeof inspection.issueCount === "number"
              ? inspection.issueCount
              : await loadInspectionIssueCount(ctx, inspection._id)
          );
        })
      ),
    };
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
        const metrics = await getRoomInspectionMetrics(ctx, roomInspection);

        return {
          ...roomInspection,
          ...metrics,
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
    const property = await ctx.db.get(args.propertyId);
    const lifecycleDecision = validateChecklistStartFromJob({
      jobIdProvided: !!args.jobId,
      job: job
        ? {
            propertyId: job.propertyId,
            status: job.status,
            jobType: job.jobType,
            scheduledStart: job.scheduledStart,
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
      currentTime: Date.now(),
      propertyTimeZone: property?.timezone,
    });

    if (lifecycleDecision.existingInspectionId && existingInspection) {
      return existingInspection._id;
    }

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

    await assertActiveInspectionCapacity(
      ctx,
      assigneeId,
      assignmentRoleForChecklistType(args.type)
    );

    const inspectionId = await ctx.db.insert("inspections", {
      propertyId: args.propertyId,
      propertyName: property.name,
      type: args.type,
      assigneeId,
      assigneeName: assignee.name,
      createdById: actor._id,
      status: "IN_PROGRESS",
      issueCount: 0,
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
          totalTasks: tasks.length,
          completedTasks: 0,
          issueCount: 0,
          photoCount: 0,
          requiredPhotoMin,
        });

        for (const task of tasks) {
          await ctx.db.insert("taskResults", {
            taskId: task.sourceTaskId,
            inspectionId,
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

export const getCompletedReview = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) {
      throw new Error("Inspection not found");
    }

    if (inspection.status !== "COMPLETED") {
      throw new Error("Completed review is only available for completed checklists");
    }

    const property = await ctx.db.get(inspection.propertyId);

    const roomInspections = (
      await ctx.db
        .query("roomInspections")
        .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
        .collect()
    ).sort((a, b) => a._creationTime - b._creationTime);

    const [taskResults, photos] = await Promise.all([
      loadInspectionTaskResults(ctx, args.inspectionId, roomInspections),
      ctx.db
        .query("photos")
        .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
        .collect(),
    ]);

    const roomSortIndex = new Map(
      roomInspections.map((roomInspection, index) => [roomInspection._id, index])
    );

    const photosWithUrls = await Promise.all(
      photos
        .sort((a, b) => {
          const roomIndexDelta =
            (roomSortIndex.get(a.roomInspectionId) ?? Number.MAX_SAFE_INTEGER) -
            (roomSortIndex.get(b.roomInspectionId) ?? Number.MAX_SAFE_INTEGER);

          if (roomIndexDelta !== 0) {
            return roomIndexDelta;
          }

          return a._creationTime - b._creationTime;
        })
        .map(async (photo) => ({
          ...photo,
          url: await ctx.storage.getUrl(photo.storageId),
        }))
    );

    return buildCompletedInspectionReview({
      inspection,
      property,
      roomInspections,
      taskResults,
      photos: photosWithUrls,
    });
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

    const [taskResults, photos] = await Promise.all([
      loadInspectionTaskResults(ctx, args.inspectionId, roomInspections),
      ctx.db
        .query("photos")
        .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
        .collect(),
    ]);

    const tasksByRoomInspectionId = new Map<Id<"roomInspections">, typeof taskResults>();
    for (const task of taskResults) {
      const existing = tasksByRoomInspectionId.get(task.roomInspectionId);
      if (existing) {
        existing.push(task);
      } else {
        tasksByRoomInspectionId.set(task.roomInspectionId, [task]);
      }
    }

    const photoCountByRoomInspectionId = new Map<Id<"roomInspections">, number>();
    for (const photo of photos) {
      photoCountByRoomInspectionId.set(
        photo.roomInspectionId,
        (photoCountByRoomInspectionId.get(photo.roomInspectionId) ?? 0) + 1
      );
    }

    return buildInspectionReport({
      inspection,
      property,
      roomInspections,
      taskResults,
      photoCountByRoomInspectionId,
    });
  },
});


