import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";
import {
  checklistTypeForJobType,
  jobIntakeSourceValidator,
  jobPriorityValidator,
  jobStatusValidator,
  servicePlanTypeValidator,
} from "./lib/validators";
import { getJobDeleteBlockReason } from "./lib/jobDeletion";
import {
  getChecklistActiveLimitBlockReason,
  getJobChecklistStartTiming,
  getMaxActiveChecklistsForRole,
} from "./lib/jobLifecycle";
import { notifyAdminsOfJobEvent } from "./lib/adminNotifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACK_TO_BACK_ARRIVAL_HOUR = 16;

function isDispatchActiveStatus(status: Doc<"jobs">["status"]) {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

function buildBackToBackArrivalDeadline(scheduledStart: number) {
  const arrivalDeadline = new Date(scheduledStart);
  arrivalDeadline.setHours(BACK_TO_BACK_ARRIVAL_HOUR, 0, 0, 0);
  return arrivalDeadline.getTime();
}

function requiredAssignmentRoleForJob(
  job: Pick<Doc<"jobs">, "jobType">,
  servicePlan: Doc<"servicePlans"> | null
): "CLEANER" | "INSPECTOR" {
  const checklistType = checklistTypeForJobType(job.jobType);

  if (checklistType === "INSPECTION") {
    return "INSPECTOR";
  }

  if (checklistType === "CLEANING") {
    return "CLEANER";
  }

  return servicePlan?.defaultAssigneeRole ?? "CLEANER";
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getAssignedWorkerIds(job: Pick<Doc<"jobs">, "assigneeId" | "additionalAssigneeIds">) {
  return [...new Set([job.assigneeId, ...(job.additionalAssigneeIds ?? [])].filter(isDefined))];
}

function isUserAssignedToJob(
  job: Pick<Doc<"jobs">, "assigneeId" | "additionalAssigneeIds">,
  userId: Id<"users">
) {
  return getAssignedWorkerIds(job).some((assignedId) => assignedId === userId);
}

function buildChecklistStartState(params: {
  job: Pick<
    Doc<"jobs">,
    "assigneeId" | "linkedInspectionId" | "scheduledStart" | "status"
  >;
  checklistType: ReturnType<typeof checklistTypeForJobType>;
  propertyTimeZone?: string;
  assigneeRole?: "CLEANER" | "INSPECTOR";
  activeInspectionCount?: number;
}) {
  if (params.job.linkedInspectionId) {
    return {
      canStartChecklist: true,
      checklistStartBlockReason: undefined,
    };
  }

  if (params.job.assigneeId === undefined) {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: "Assign this job before starting a checklist",
    };
  }

  if (params.job.status === "COMPLETED" || params.job.status === "CANCELLED") {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: "This job cannot start a checklist",
    };
  }

  if (params.checklistType === null) {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: "This job type does not support checklist execution",
    };
  }

  if (!params.assigneeRole) {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: "Assigned worker account is unavailable",
    };
  }

  const timing = getJobChecklistStartTiming({
    scheduledStart: params.job.scheduledStart,
    currentTime: Date.now(),
    timeZone: params.propertyTimeZone,
  });
  if (!timing.canStart) {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: timing.blockReason,
    };
  }

  const activeInspectionCount = params.activeInspectionCount ?? 0;
  const activeLimit = getMaxActiveChecklistsForRole(params.assigneeRole);
  if (activeInspectionCount >= activeLimit) {
    return {
      canStartChecklist: false,
      checklistStartBlockReason: getChecklistActiveLimitBlockReason({
        role: params.assigneeRole,
        activeCount: activeInspectionCount,
      }),
    };
  }

  return {
    canStartChecklist: true,
    checklistStartBlockReason: undefined,
  };
}

async function hydrateJobListItems(
  ctx: QueryCtx,
  jobs: Array<Doc<"jobs">>,
  viewerId?: Id<"users">
) {
  const propertyIds = [...new Set(jobs.map((job) => job.propertyId))];
  const assigneeIds = [...new Set(jobs.flatMap(getAssignedWorkerIds))];

  const [properties, assignees, activeInspectionCounts] = await Promise.all([
    Promise.all(propertyIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
    Promise.all(assigneeIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
    Promise.all(
      assigneeIds.map(async (id) => {
        const activeInspections = await ctx.db
          .query("inspections")
          .withIndex("by_assignee_status", (q) =>
            q.eq("assigneeId", id).eq("status", "IN_PROGRESS")
          )
          .collect();

        return [id, activeInspections.length] as const;
      })
    ),
  ]);

  const propertyById = new Map(properties);
  const assigneeById = new Map(assignees);
  const activeInspectionCountByAssigneeId = new Map(activeInspectionCounts);

  return jobs.map((job) => {
    const property = propertyById.get(job.propertyId) ?? null;
    const assignedWorkerIds = getAssignedWorkerIds(job);
    const assignee = job.assigneeId ? (assigneeById.get(job.assigneeId) ?? null) : null;
    const assignees = assignedWorkerIds
      .map((assigneeId) => assigneeById.get(assigneeId))
      .filter(isDefined);
    const startAssigneeId =
      viewerId && assignedWorkerIds.some((assigneeId) => assigneeId === viewerId)
        ? viewerId
        : job.assigneeId;
    const startAssignee = startAssigneeId
      ? (assigneeById.get(startAssigneeId) ?? null)
      : null;
    const checklistType = checklistTypeForJobType(job.jobType);
    const assigneeRole =
      startAssignee?.role === "CLEANER" || startAssignee?.role === "INSPECTOR"
        ? startAssignee.role
        : undefined;
    const startState = buildChecklistStartState({
      job: {
        ...job,
        assigneeId: startAssigneeId,
      },
      checklistType,
      propertyTimeZone: property?.timezone,
      assigneeRole,
      activeInspectionCount: startAssigneeId
        ? activeInspectionCountByAssigneeId.get(startAssigneeId)
        : undefined,
    });

    return {
      _id: job._id,
      _creationTime: job._creationTime,
      propertyId: job.propertyId,
      scheduledStart: job.scheduledStart,
      scheduledEnd: job.scheduledEnd,
      assigneeId: job.assigneeId,
      additionalAssigneeIds: job.additionalAssigneeIds,
      assigneeIds: assignedWorkerIds,
      linkedInspectionId: job.linkedInspectionId,
      propertyName: property?.name ?? "Unknown property",
      propertyAddress: property?.address ?? "",
      propertyBedrooms: property?.bedrooms,
      propertyBathrooms: property?.bathrooms,
      status: job.status,
      jobType: job.jobType,
      priority: job.priority,
      arrivalDeadline: job.arrivalDeadline,
      isBackToBack: job.isBackToBack === true,
      assigneeName: assignee?.name ?? null,
      assigneeNames: assignees.map((worker) => worker.name),
      assignmentCount: assignedWorkerIds.length,
      checklistType,
      canStartChecklist: startState.canStartChecklist,
      checklistStartBlockReason: startState.checklistStartBlockReason,
    };
  });
}

async function recordJobEvent(
  ctx: MutationCtx,
  params: {
    jobId: Id<"jobs">;
    actorId: Id<"users">;
    eventType: string;
    metadata: Record<string, unknown>;
  }
) {
  await ctx.db.insert("jobEvents", {
    jobId: params.jobId,
    actorId: params.actorId,
    eventType: params.eventType,
    metadata: JSON.stringify(params.metadata),
    createdAt: Date.now(),
  });
}

async function getJobForAdminUpdate(
  ctx: MutationCtx,
  jobId: Id<"jobs">
): Promise<{
  actor: Doc<"users">;
  job: Doc<"jobs">;
  property: Doc<"properties">;
  servicePlan: Doc<"servicePlans"> | null;
}> {
  const actor = await requireAdmin(ctx);
  const job = await ctx.db.get(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  const [property, servicePlan] = await Promise.all([
    ctx.db.get(job.propertyId),
    job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
  ]);

  if (!property) {
    throw new Error("Property not found");
  }

  if (!property.isActive || property.isArchived === true) {
    throw new Error("Dispatch updates are blocked because this property is archived or inactive");
  }

  if (job.status === "COMPLETED") {
    throw new Error("Completed jobs cannot be edited from dispatch");
  }

  return {
    actor,
    job,
    property,
    servicePlan,
  };
}

async function getJobForAssigneeUpdate(
  ctx: MutationCtx,
  jobId: Id<"jobs">
): Promise<{
  actor: Doc<"users">;
  job: Doc<"jobs">;
  property: Doc<"properties">;
}> {
  const actor = await requireAuth(ctx);
  const job = await ctx.db.get(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  if (!isUserAssignedToJob(job, actor._id)) {
    throw new Error("Only the assigned worker can update this job");
  }

  const property = await ctx.db.get(job.propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  if (!property.isActive || property.isArchived === true) {
    throw new Error("Job updates are blocked because this property is archived or inactive");
  }

  if (job.status === "COMPLETED" || job.status === "CANCELLED") {
    throw new Error("This job can no longer be updated from the worker schedule");
  }

  return {
    actor,
    job,
    property,
  };
}

async function ensureAssigneeEligible(
  ctx: MutationCtx,
  params: {
    assigneeId: Id<"users">;
    requiredRole: "CLEANER" | "INSPECTOR";
  }
) {
  const assignee = await ctx.db.get(params.assigneeId);

  if (!assignee) {
    throw new Error("Assignee not found");
  }

  if (!assignee.isActive) {
    throw new Error("Assignee account is deactivated");
  }

  if (assignee.role !== params.requiredRole) {
    throw new Error(`Assignee must have role ${params.requiredRole}`);
  }

  return assignee;
}

function jobsOverlap(
  left: { scheduledStart: number; scheduledEnd: number },
  right: { scheduledStart: number; scheduledEnd: number }
) {
  return left.scheduledStart < right.scheduledEnd && right.scheduledStart < left.scheduledEnd;
}

async function findAssigneeConflict(
  ctx: MutationCtx,
  params: {
    assigneeId: Id<"users">;
    scheduledStart: number;
    scheduledEnd: number;
    excludeJobId?: Id<"jobs">;
  }
) {
  const activeStatuses: Array<Doc<"jobs">["status"]> = [
    "SCHEDULED",
    "IN_PROGRESS",
    "BLOCKED",
  ];

  const jobGroups = await Promise.all(
    activeStatuses.map((status) =>
      ctx.db
        .query("jobs")
        .withIndex("by_assignee_status_start", (q) =>
          q
            .eq("assigneeId", params.assigneeId)
            .eq("status", status)
            .lt("scheduledStart", params.scheduledEnd)
        )
        .collect()
    )
  );

  const jobs = jobGroups.flat();

  return jobs.find(
    (job) =>
      job._id !== params.excludeJobId &&
      jobsOverlap(job, {
        scheduledStart: params.scheduledStart,
        scheduledEnd: params.scheduledEnd,
      })
  );
}

async function assertNoAssigneeConflict(
  ctx: MutationCtx,
  params: {
    assigneeId: Id<"users">;
    scheduledStart: number;
    scheduledEnd: number;
    excludeJobId?: Id<"jobs">;
  }
) {
  const conflict = await findAssigneeConflict(ctx, params);

  if (!conflict) {
    return;
  }

  const property = await ctx.db.get(conflict.propertyId);
  throw new Error(
    `Assignee already has overlapping work at ${property?.name ?? "another property"} starting ${new Date(
      conflict.scheduledStart
    ).toISOString()}`
  );
}

export const listMyUpcoming = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const from = args.from ?? Date.now();
    const to = args.to ?? from + 14 * DAY_MS;
    const includeCompleted = args.includeCompleted === true;

    let jobs: Array<Doc<"jobs">>;
    if (user.role === "ADMIN") {
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_scheduled_start", (q) =>
          q.gte("scheduledStart", from).lte("scheduledStart", to)
        )
        .collect();
    } else {
      const primaryJobs = await ctx.db
        .query("jobs")
        .withIndex("by_assignee_start", (q) =>
          q.eq("assigneeId", user._id).gte("scheduledStart", from).lte("scheduledStart", to)
        )
        .collect();
      const splitJobs = await ctx.db
        .query("jobs")
        .withIndex("by_scheduled_start", (q) =>
          q.gte("scheduledStart", from).lte("scheduledStart", to)
        )
        .collect();
      const jobsById = new Map<string, Doc<"jobs">>();
      for (const job of primaryJobs) {
        jobsById.set(String(job._id), job);
      }
      for (const job of splitJobs) {
        if ((job.additionalAssigneeIds ?? []).some((assigneeId) => assigneeId === user._id)) {
          jobsById.set(String(job._id), job);
        }
      }
      jobs = Array.from(jobsById.values());
    }

    const filtered = jobs
      .filter((job) => (includeCompleted ? true : job.status !== "COMPLETED"))
      .filter((job) => job.status !== "CANCELLED")
      .sort((a, b) => a.scheduledStart - b.scheduledStart);

    return await hydrateJobListItems(ctx, filtered, user.role === "ADMIN" ? undefined : user._id);
  },
});

export const listAdminDispatch = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const from = args.from ?? Date.now();
    const to = args.to ?? from + 14 * DAY_MS;

    if (to <= from) {
      throw new Error("`to` must be greater than `from`");
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scheduled_start", (q) =>
        q.gte("scheduledStart", from).lte("scheduledStart", to)
      )
      .collect();

    return await hydrateJobListItems(ctx, jobs.sort((a, b) => a.scheduledStart - b.scheduledStart));
  },
});

export const listByProperty = query({
  args: {
    propertyId: v.id("properties"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const from = args.from ?? Date.now() - DAY_MS;
    const to = args.to ?? Date.now() + 14 * DAY_MS;

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_property_start", (q) =>
        q
          .eq("propertyId", args.propertyId)
          .gte("scheduledStart", from)
          .lte("scheduledStart", to)
      )
      .collect();

    return await hydrateJobListItems(ctx, jobs.sort((a, b) => a.scheduledStart - b.scheduledStart));
  },
});

export const getById = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    if (user.role !== "ADMIN" && !isUserAssignedToJob(job, user._id)) {
      throw new Error("You do not have access to this job");
    }

    const assignedWorkerIds = getAssignedWorkerIds(job);
    const startAssigneeId =
      user.role !== "ADMIN" && isUserAssignedToJob(job, user._id) ? user._id : job.assigneeId;

    const [property, servicePlan, assignees, linkedInspection, activeInspections] = await Promise.all([
      ctx.db.get(job.propertyId),
      job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
      Promise.all(assignedWorkerIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
      job.linkedInspectionId ? ctx.db.get(job.linkedInspectionId) : Promise.resolve(null),
      startAssigneeId
        ? ctx.db
            .query("inspections")
            .withIndex("by_assignee_status", (q) =>
              q.eq("assigneeId", startAssigneeId).eq("status", "IN_PROGRESS")
            )
            .collect()
        : Promise.resolve([]),
    ]);
    const assigneeById = new Map(assignees);
    const assignee = job.assigneeId ? (assigneeById.get(job.assigneeId) ?? null) : null;
    const startAssignee = startAssigneeId ? (assigneeById.get(startAssigneeId) ?? null) : null;
    const activeAssignees = assignedWorkerIds
      .map((assigneeId) => assigneeById.get(assigneeId))
      .filter(isDefined);

    const events = await ctx.db
      .query("jobEvents")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const checklistType = checklistTypeForJobType(job.jobType);
    const assigneeRole =
      startAssignee?.role === "CLEANER" || startAssignee?.role === "INSPECTOR"
        ? startAssignee.role
        : undefined;
    const startState = buildChecklistStartState({
      job: {
        ...job,
        assigneeId: startAssigneeId,
      },
      checklistType,
      propertyTimeZone: property?.timezone,
      assigneeRole,
      activeInspectionCount: activeInspections.length,
    });

    return {
      ...job,
      clientLabel: property?.clientLabel ?? job.clientLabel ?? undefined,
      property,
      servicePlan,
      assignee,
      assignees: activeAssignees,
      assigneeIds: assignedWorkerIds,
      assigneeNames: activeAssignees.map((worker) => worker.name),
      assignmentCount: assignedWorkerIds.length,
      linkedInspection,
      checklistType,
      canStartChecklist: startState.canStartChecklist,
      checklistStartBlockReason: startState.checklistStartBlockReason,
      events: events.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const reassign = mutation({
  args: {
    jobId: v.id("jobs"),
    assigneeId: v.union(v.id("users"), v.null()),
    assigneeIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { actor, job, property, servicePlan } = await getJobForAdminUpdate(ctx, args.jobId);
    const requestedAssigneeIds = args.assigneeIds
      ? [...new Set(args.assigneeIds)]
      : args.assigneeId
        ? [args.assigneeId]
        : [];
    const nextAssigneeId = requestedAssigneeIds[0];
    const nextAdditionalAssigneeIds = requestedAssigneeIds.slice(1);
    const currentAssigneeIds = getAssignedWorkerIds(job);
    if (requestedAssigneeIds.length > 8) {
      throw new Error("Jobs can include up to 8 assigned workers");
    }
    if (
      currentAssigneeIds.length === requestedAssigneeIds.length &&
      currentAssigneeIds.every((assignedId, index) => assignedId === requestedAssigneeIds[index])
    ) {
      return job._id;
    }

    if (requestedAssigneeIds.length > 0) {
      const requiredRole = requiredAssignmentRoleForJob(job, servicePlan);
      for (const requestedAssigneeId of requestedAssigneeIds) {
        const assignee = await ensureAssigneeEligible(ctx, {
          assigneeId: requestedAssigneeId,
          requiredRole,
        });

        if (isDispatchActiveStatus(job.status) && requiredRole !== "CLEANER") {
          await assertNoAssigneeConflict(ctx, {
            assigneeId: assignee._id,
            scheduledStart: job.scheduledStart,
            scheduledEnd: job.scheduledEnd,
            excludeJobId: job._id,
          });
        }
      }
    }

    await ctx.db.patch(job._id, {
      assigneeId: nextAssigneeId,
      additionalAssigneeIds:
        nextAdditionalAssigneeIds.length > 0 ? nextAdditionalAssigneeIds : undefined,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_REASSIGNED",
      metadata: {
        previousAssigneeId: job.assigneeId ?? null,
        nextAssigneeId: nextAssigneeId ?? null,
        previousAssigneeIds: currentAssigneeIds,
        nextAssigneeIds: requestedAssigneeIds,
        propertyId: property._id,
      },
    });

    return job._id;
  },
});

export const createManual = mutation({
  args: {
    propertyId: v.id("properties"),
    jobType: servicePlanTypeValidator,
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    assigneeId: v.optional(v.id("users")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    priority: v.optional(jobPriorityValidator),
    intakeSource: jobIntakeSourceValidator,
    clientLabel: v.optional(v.string()),
    isBackToBack: v.optional(v.boolean()),
    arrivalDeadline: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const property = await ctx.db.get(args.propertyId);

    if (!property || !property.isActive || property.isArchived === true) {
      throw new Error("Property not found or archived");
    }

    if (args.scheduledEnd <= args.scheduledStart) {
      throw new Error("Scheduled end must be after scheduled start");
    }

    const requestedAssigneeIds =
      args.assigneeIds !== undefined
        ? [...new Set(args.assigneeIds)]
        : args.assigneeId
          ? [args.assigneeId]
          : [];
    const assigneeId = requestedAssigneeIds[0];
    const additionalAssigneeIds = requestedAssigneeIds.slice(1);
    const notes = args.notes?.trim() || undefined;
    const clientLabel = args.clientLabel?.trim() || undefined;
    const isBackToBack = args.isBackToBack === true;
    const arrivalDeadline = isBackToBack
      ? buildBackToBackArrivalDeadline(args.scheduledStart)
      : args.arrivalDeadline;
    if (requestedAssigneeIds.length > 8) {
      throw new Error("Split jobs can include up to 8 assigned workers");
    }

    if (requestedAssigneeIds.length > 0) {
      const requiredRole = requiredAssignmentRoleForJob(
        {
          jobType: args.jobType,
        },
        null
      );

      for (const assignedWorkerId of requestedAssigneeIds) {
        const assignee = await ensureAssigneeEligible(ctx, {
          assigneeId: assignedWorkerId,
          requiredRole,
        });

        if (requiredRole !== "CLEANER") {
          await assertNoAssigneeConflict(ctx, {
            assigneeId: assignee._id,
            scheduledStart: args.scheduledStart,
            scheduledEnd: args.scheduledEnd,
          });
        }
      }
    }

    const jobId = await ctx.db.insert("jobs", {
      propertyId: args.propertyId,
      jobType: args.jobType,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      status: "SCHEDULED",
      priority: args.priority ?? "MEDIUM",
      intakeSource: args.intakeSource,
      createdById: actor._id,
      ...(assigneeId ? { assigneeId } : {}),
      ...(additionalAssigneeIds.length > 0 ? { additionalAssigneeIds } : {}),
      ...(clientLabel ? { clientLabel } : {}),
      ...(isBackToBack ? { isBackToBack: true } : {}),
      ...(arrivalDeadline !== undefined ? { arrivalDeadline } : {}),
      ...(notes ? { notes } : {}),
    });

    await recordJobEvent(ctx, {
      jobId,
      actorId: actor._id,
      eventType: "JOB_CREATED",
      metadata: {
        source: "manual_dispatch",
        propertyId: args.propertyId,
        assigneeId: assigneeId ?? null,
        assigneeIds: requestedAssigneeIds,
        intakeSource: args.intakeSource,
        clientLabel: clientLabel ?? null,
        isBackToBack,
        arrivalDeadline: arrivalDeadline ?? null,
      },
    });

    return jobId;
  },
});

export const reschedule = mutation({
  args: {
    jobId: v.id("jobs"),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    isBackToBack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { actor, job, servicePlan } = await getJobForAdminUpdate(ctx, args.jobId);
    const nextIsBackToBack = args.isBackToBack ?? (job.isBackToBack === true);
    const hasTimingChange =
      job.scheduledStart !== args.scheduledStart || job.scheduledEnd !== args.scheduledEnd;
    const hasBackToBackChange = nextIsBackToBack !== (job.isBackToBack === true);

    if (args.scheduledEnd <= args.scheduledStart) {
      throw new Error("Scheduled end must be after scheduled start");
    }

    if (nextIsBackToBack && job.jobType !== "CLEANING") {
      throw new Error("Only cleaning jobs can be marked as B2B");
    }

    const requiredRole = requiredAssignmentRoleForJob(job, servicePlan);
    if (
      job.assigneeId &&
      requiredRole !== "CLEANER" &&
      isDispatchActiveStatus(job.status) &&
      hasTimingChange
    ) {
      await assertNoAssigneeConflict(ctx, {
        assigneeId: job.assigneeId,
        scheduledStart: args.scheduledStart,
        scheduledEnd: args.scheduledEnd,
        excludeJobId: job._id,
      });
    }

    const nextArrivalDeadline = nextIsBackToBack
      ? buildBackToBackArrivalDeadline(args.scheduledStart)
      : undefined;

    await ctx.db.patch(job._id, {
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      isBackToBack: nextIsBackToBack ? true : undefined,
      arrivalDeadline: nextArrivalDeadline,
    });

    if (hasTimingChange || hasBackToBackChange) {
      await recordJobEvent(ctx, {
        jobId: job._id,
        actorId: actor._id,
        eventType: hasTimingChange ? "JOB_RESCHEDULED" : "JOB_BACK_TO_BACK_UPDATED",
        metadata: {
          previousScheduledStart: job.scheduledStart,
          previousScheduledEnd: job.scheduledEnd,
          nextScheduledStart: args.scheduledStart,
          nextScheduledEnd: args.scheduledEnd,
          previousIsBackToBack: job.isBackToBack === true,
          nextIsBackToBack,
          previousArrivalDeadline: job.arrivalDeadline ?? null,
          nextArrivalDeadline: nextArrivalDeadline ?? null,
        },
      });
    }

    return job._id;
  },
});

export const updateStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: jobStatusValidator,
  },
  handler: async (ctx, args) => {
    const { actor, job, property } = await getJobForAdminUpdate(ctx, args.jobId);

    if (args.status === "COMPLETED") {
      throw new Error("Dispatch cannot directly complete jobs");
    }

    if (job.status === args.status) {
      return job._id;
    }

    if (job.assigneeId && isDispatchActiveStatus(args.status)) {
      await assertNoAssigneeConflict(ctx, {
        assigneeId: job.assigneeId,
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
        excludeJobId: job._id,
      });
    }

    await ctx.db.patch(job._id, {
      status: args.status,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_STATUS_UPDATED",
      metadata: {
        previousStatus: job.status,
        nextStatus: args.status,
      },
    });

    if (args.status === "IN_PROGRESS") {
      await notifyAdminsOfJobEvent(ctx, {
        jobId: job._id,
        actorId: actor._id,
        actorName: actor.name,
        propertyName: property.name,
        eventType: "JOB_STARTED",
      });
    }

    return job._id;
  },
});

export const completeByAdmin = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const { actor, job, property } = await getJobForAdminUpdate(ctx, args.jobId);

    if (job.linkedInspectionId) {
      throw new Error("Jobs with linked checklists must be completed from the checklist flow");
    }

    if (job.status === "CANCELLED") {
      throw new Error("Cancelled jobs cannot be auto-completed");
    }

    const checklistType = checklistTypeForJobType(job.jobType);
    if (!checklistType) {
      throw new Error("This job type cannot be auto-completed into history");
    }

    const assignee = job.assigneeId ? await ctx.db.get(job.assigneeId) : null;
    const inspectionAssigneeId = assignee?._id ?? actor._id;
    const inspectionAssigneeName = assignee?.name ?? actor.name;
    const completedAt = Date.now();

    const inspectionId = await ctx.db.insert("inspections", {
      propertyId: job.propertyId,
      propertyName: property.name,
      type: checklistType,
      assigneeId: inspectionAssigneeId,
      assigneeName: inspectionAssigneeName,
      createdById: actor._id,
      status: "COMPLETED",
      issueCount: 0,
      completedAt,
      notes: "Completed from dispatch by admin",
    });

    await ctx.db.patch(job._id, {
      linkedInspectionId: inspectionId,
      status: "COMPLETED",
      completedAt,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_ADMIN_COMPLETED",
      metadata: {
        previousStatus: job.status,
        completedAt,
        inspectionId,
        checklistType,
        source: "admin_dispatch",
      },
    });

    await notifyAdminsOfJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      actorName: actor.name,
      propertyName: property.name,
      eventType: "JOB_COMPLETED",
    });

    return job._id;
  },
});

export const remove = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const deleteBlockReason = getJobDeleteBlockReason(job);
    if (deleteBlockReason) {
      throw new Error(deleteBlockReason);
    }

    const events = await ctx.db
      .query("jobEvents")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    await ctx.db.delete(job._id);

    return {
      deletedJobId: job._id,
      deletedEventCount: events.length,
    };
  },
});
export const updateMyStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("IN_PROGRESS"), v.literal("BLOCKED")),
  },
  handler: async (ctx, args) => {
    const { actor, job } = await getJobForAssigneeUpdate(ctx, args.jobId);

    if (job.status === args.status) {
      return job._id;
    }

    await ctx.db.patch(job._id, {
      status: args.status,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_STATUS_UPDATED",
      metadata: {
        previousStatus: job.status,
        nextStatus: args.status,
        source: "worker_schedule",
      },
    });

    if (args.status === "IN_PROGRESS") {
      const property = await ctx.db.get(job.propertyId);
      await notifyAdminsOfJobEvent(ctx, {
        jobId: job._id,
        actorId: actor._id,
        actorName: actor.name,
        propertyName: property?.name ?? "a scheduled property",
        eventType: "JOB_STARTED",
      });
    }

    return job._id;
  },
});

