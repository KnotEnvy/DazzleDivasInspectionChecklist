import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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
import { notifyAdminsOfJobEvent } from "./lib/adminNotifications";

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

async function loadFinancialApprovalByInspectionId(
  ctx: QueryCtx,
  inspections: Array<Pick<Doc<"inspections">, "_id" | "type">>
) {
  const entries = await Promise.all(
    inspections.map(async (inspection) => {
      if (inspection.type !== "CLEANING") {
        return [inspection._id, false] as const;
      }

      const linkedJob = await ctx.db
        .query("jobs")
        .withIndex("by_linked_inspection", (q) => q.eq("linkedInspectionId", inspection._id))
        .unique();

      if (!linkedJob) {
        return [inspection._id, false] as const;
      }

      const jobFinancial = await ctx.db
        .query("jobFinancials")
        .withIndex("by_job", (q) => q.eq("jobId", linkedJob._id))
        .unique();

      return [inspection._id, jobFinancial?.status === "APPROVED"] as const;
    })
  );

  return new Map(entries);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getAssignedWorkerIds(job: Pick<Doc<"jobs">, "assigneeId" | "additionalAssigneeIds">) {
  return [...new Set([job.assigneeId, ...(job.additionalAssigneeIds ?? [])].filter(isDefined))];
}

async function loadLinkedJobsByInspectionId(
  ctx: QueryCtx,
  inspections: Array<Pick<Doc<"inspections">, "_id">>
) {
  const entries = await Promise.all(
    inspections.map(async (inspection) => {
      const linkedJobs = await ctx.db
        .query("jobs")
        .withIndex("by_linked_inspection", (q) => q.eq("linkedInspectionId", inspection._id))
        .collect();

      return [inspection._id, linkedJobs] as const;
    })
  );

  return new Map(entries);
}

async function loadAssigneeNamesByUserId(ctx: QueryCtx, userIds: Array<Id<"users">>) {
  const uniqueUserIds = [...new Set(userIds)];
  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await ctx.db.get(userId)] as const)
  );

  return new Map(
    users
      .filter((entry): entry is [Id<"users">, Doc<"users">] => entry[1] !== null)
      .map(([userId, user]) => [userId, user.name] as const)
  );
}

async function buildCompletedHistoryItems(
  ctx: QueryCtx,
  inspections: Array<Doc<"inspections">>
) {
  const [financialApprovalByInspectionId, linkedJobsByInspectionId] = await Promise.all([
    loadFinancialApprovalByInspectionId(ctx, inspections),
    loadLinkedJobsByInspectionId(ctx, inspections),
  ]);
  const assigneeNamesByUserId = await loadAssigneeNamesByUserId(
    ctx,
    Array.from(linkedJobsByInspectionId.values()).flatMap((linkedJobs) =>
      linkedJobs.flatMap(getAssignedWorkerIds)
    )
  );

  return await Promise.all(
    inspections.map(async (inspection) => {
      const linkedJobs = linkedJobsByInspectionId.get(inspection._id) ?? [];
      const linkedAssigneeNames = linkedJobs
        .flatMap(getAssignedWorkerIds)
        .map((assigneeId) => assigneeNamesByUserId.get(assigneeId))
        .filter(isDefined);
      const assigneeNames = linkedAssigneeNames.length > 0
        ? [...new Set(linkedAssigneeNames)]
        : [inspection.assigneeName];

      return {
        ...buildCompletedInspectionHistoryItem(
          inspection,
          typeof inspection.issueCount === "number"
            ? inspection.issueCount
            : await loadInspectionIssueCount(ctx, inspection._id),
          {
            financialApproved: financialApprovalByInspectionId.get(inspection._id) === true,
          }
        ),
        assigneeNames,
      };
    })
  );
}

async function loadCompletedInspectionsForHistory(ctx: QueryCtx, user: Doc<"users">) {
  const inspections =
    user.role === "ADMIN"
      ? await ctx.db
          .query("inspections")
          .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
          .order("desc")
          .collect()
      : await ctx.db
          .query("inspections")
          .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
          .order("desc")
          .collect();

  if (user.role === "ADMIN") {
    return inspections;
  }

  const linkedJobsByInspectionId = await loadLinkedJobsByInspectionId(ctx, inspections);
  return inspections.filter((inspection) => {
    if (inspection.assigneeId === user._id) {
      return true;
    }

    const linkedJobs = linkedJobsByInspectionId.get(inspection._id) ?? [];
    return linkedJobs.some((job) => getAssignedWorkerIds(job).some((assigneeId) => assigneeId === user._id));
  });
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

    return await buildCompletedHistoryItems(
      ctx,
      await loadCompletedInspectionsForHistory(ctx, user)
    );
  },
});

export const listCompletedPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (user.role !== "ADMIN") {
      if (args.paginationOpts.cursor !== null) {
        return {
          page: [],
          isDone: true,
          continueCursor: "",
        };
      }

      return {
        page: await buildCompletedHistoryItems(
          ctx,
          await loadCompletedInspectionsForHistory(ctx, user)
        ),
        isDone: true,
        continueCursor: "",
      };
    }

    const results = await ctx.db
      .query("inspections")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...results,
      page: await buildCompletedHistoryItems(ctx, results.page),
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
      canStop:
        inspection.status === "IN_PROGRESS" &&
        !inspection.notes?.trim() &&
        roomsWithProgress.every(
          (room) =>
            room.status === "PENDING" &&
            !room.notes?.trim() &&
            room.completedTasks === 0 &&
            (room.issueCount ?? 0) === 0 &&
            room.photoCount === 0
        ),
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
            additionalAssigneeIds: job.additionalAssigneeIds,
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
      const currentAdditionalAssigneeIds = job.additionalAssigneeIds ?? [];
      const nextAdditionalAssigneeIds =
        job.assigneeId || assigneeId === job.assigneeId
          ? currentAdditionalAssigneeIds
          : currentAdditionalAssigneeIds.filter((assignedId) => assignedId !== assigneeId);

      await ctx.db.patch(job._id, {
        linkedInspectionId: inspectionId,
        assigneeId: job.assigneeId ?? assigneeId,
        additionalAssigneeIds:
          nextAdditionalAssigneeIds.length > 0 ? nextAdditionalAssigneeIds : undefined,
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
      if (job.status !== "IN_PROGRESS") {
        await notifyAdminsOfJobEvent(ctx, {
          jobId: job._id,
          actorId: actor._id,
          actorName: actor.name,
          propertyName: property.name,
          eventType: "JOB_STARTED",
        });
      }
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
      await notifyAdminsOfJobEvent(ctx, {
        jobId: job._id,
        actorId: user._id,
        actorName: user.name,
        propertyName: inspection.propertyName,
        eventType: "JOB_COMPLETED",
      });
    }
  },
});

export const stopUnstarted = mutation({
  args: {
    inspectionId: v.id("inspections"),
  },
  handler: async (ctx, args) => {
    const { inspection, user } = await requireInspectionAccess(ctx, args.inspectionId);

    if (inspection.status !== "IN_PROGRESS") {
      throw new Error("Only an in-progress checklist can be stopped");
    }

    const rooms = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();
    const taskResults = (
      await Promise.all(
        rooms.map((room) =>
          ctx.db
            .query("taskResults")
            .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", room._id))
            .collect()
        )
      )
    ).flat();
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    const hasMarkedWork =
      !!inspection.notes?.trim() ||
      photos.length > 0 ||
      rooms.some(
        (room) =>
          room.status !== "PENDING" ||
          !!room.notes?.trim() ||
          (room.completedTasks ?? 0) > 0 ||
          (room.issueCount ?? 0) > 0 ||
          (room.photoCount ?? 0) > 0
      ) ||
      taskResults.some(
        (task) => task.completed || task.hasIssue === true || !!task.issueNotes?.trim()
      );

    if (hasMarkedWork) {
      throw new Error("This checklist cannot be stopped after tasks, notes, issues, rooms, or photos are marked");
    }

    const linkedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_linked_inspection", (q) => q.eq("linkedInspectionId", args.inspectionId))
      .collect();

    for (const taskResult of taskResults) {
      await ctx.db.delete(taskResult._id);
    }
    for (const room of rooms) {
      await ctx.db.delete(room._id);
    }
    for (const job of linkedJobs) {
      await ctx.db.patch(job._id, {
        linkedInspectionId: undefined,
        status: "SCHEDULED",
        completedAt: undefined,
      });
      await ctx.db.insert("jobEvents", {
        jobId: job._id,
        eventType: "CHECKLIST_STOPPED",
        actorId: user._id,
        metadata: JSON.stringify({ inspectionId: args.inspectionId }),
        createdAt: Date.now(),
      });
    }

    await ctx.db.delete(args.inspectionId);
    return { jobId: linkedJobs[0]?._id };
  },
});

export const deleteCompletedFromHistory = mutation({
  args: {
    inspectionId: v.id("inspections"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const reason = args.reason.trim();

    if (reason.length < 10) {
      throw new Error("Deletion reason must be at least 10 characters");
    }

    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) {
      throw new Error("Completed checklist not found");
    }

    if (inspection.status !== "COMPLETED") {
      throw new Error("Only completed checklist history can be deleted here");
    }

    const linkedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_linked_inspection", (q) => q.eq("linkedInspectionId", args.inspectionId))
      .collect();
    const primaryJob = linkedJobs.sort((left, right) => right._creationTime - left._creationTime)[0];

    await ctx.db.insert("deletedHistoryAudits", {
      inspectionId: inspection._id,
      jobId: primaryJob?._id,
      propertyId: inspection.propertyId,
      propertyName: inspection.propertyName,
      checklistType: inspection.type,
      assigneeId: inspection.assigneeId,
      assigneeName: inspection.assigneeName,
      completedAt: inspection.completedAt,
      deletedById: actor._id,
      deletedByName: actor.name,
      reason,
      deletedAt: Date.now(),
    });

    for (const job of linkedJobs) {
      const financials = await ctx.db
        .query("jobFinancials")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      for (const financial of financials) {
        const financeEvents = await ctx.db
          .query("financeEvents")
          .withIndex("by_job_financial", (q) => q.eq("jobFinancialId", financial._id))
          .collect();

        for (const event of financeEvents) {
          await ctx.db.delete(event._id);
        }

        await ctx.db.delete(financial._id);
      }

      const jobEvents = await ctx.db
        .query("jobEvents")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      for (const event of jobEvents) {
        await ctx.db.delete(event._id);
      }

      await ctx.db.delete(job._id);
    }

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    for (const photo of photos) {
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
    }

    const taskResults = await ctx.db
      .query("taskResults")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    for (const taskResult of taskResults) {
      await ctx.db.delete(taskResult._id);
    }

    const roomInspections = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", args.inspectionId))
      .collect();

    for (const roomInspection of roomInspections) {
      await ctx.db.delete(roomInspection._id);
    }

    await ctx.db.delete(inspection._id);

    return {
      deletedInspectionId: inspection._id,
      deletedJobCount: linkedJobs.length,
      deletedPhotoCount: photos.length,
      auditReason: reason,
    };
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


