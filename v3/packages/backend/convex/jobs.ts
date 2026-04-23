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

async function hydrateJobListItems(ctx: QueryCtx, jobs: Array<Doc<"jobs">>) {
  const propertyIds = [...new Set(jobs.map((job) => job.propertyId))];
  const assigneeIds = [...new Set(jobs.map((job) => job.assigneeId).filter(isDefined))];

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
    const assignee = job.assigneeId ? (assigneeById.get(job.assigneeId) ?? null) : null;
    const checklistType = checklistTypeForJobType(job.jobType);
    const assigneeRole =
      assignee?.role === "CLEANER" || assignee?.role === "INSPECTOR"
        ? assignee.role
        : undefined;
    const startState = buildChecklistStartState({
      job,
      checklistType,
      propertyTimeZone: property?.timezone,
      assigneeRole,
      activeInspectionCount: job.assigneeId
        ? activeInspectionCountByAssigneeId.get(job.assigneeId)
        : undefined,
    });

    return {
      _id: job._id,
      _creationTime: job._creationTime,
      propertyId: job.propertyId,
      scheduledStart: job.scheduledStart,
      scheduledEnd: job.scheduledEnd,
      assigneeId: job.assigneeId,
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

  if (!job.assigneeId || job.assigneeId !== actor._id) {
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
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_assignee_start", (q) =>
          q.eq("assigneeId", user._id).gte("scheduledStart", from).lte("scheduledStart", to)
        )
        .collect();
    }

    const filtered = jobs
      .filter((job) => (includeCompleted ? true : job.status !== "COMPLETED"))
      .filter((job) => job.status !== "CANCELLED")
      .sort((a, b) => a.scheduledStart - b.scheduledStart);

    return await hydrateJobListItems(ctx, filtered);
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

    if (user.role !== "ADMIN" && job.assigneeId !== user._id) {
      throw new Error("You do not have access to this job");
    }

    const [property, servicePlan, assignee, linkedInspection, activeInspections] = await Promise.all([
      ctx.db.get(job.propertyId),
      job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
      job.assigneeId ? ctx.db.get(job.assigneeId) : Promise.resolve(null),
      job.linkedInspectionId ? ctx.db.get(job.linkedInspectionId) : Promise.resolve(null),
      job.assigneeId
        ? ctx.db
            .query("inspections")
            .withIndex("by_assignee_status", (q) =>
              q.eq("assigneeId", job.assigneeId as Id<"users">).eq("status", "IN_PROGRESS")
            )
            .collect()
        : Promise.resolve([]),
    ]);

    const events = await ctx.db
      .query("jobEvents")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const checklistType = checklistTypeForJobType(job.jobType);
    const assigneeRole =
      assignee?.role === "CLEANER" || assignee?.role === "INSPECTOR"
        ? assignee.role
        : undefined;
    const startState = buildChecklistStartState({
      job,
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
  },
  handler: async (ctx, args) => {
    const { actor, job, property, servicePlan } = await getJobForAdminUpdate(ctx, args.jobId);
    const nextAssigneeId = args.assigneeId ?? undefined;
    if (job.assigneeId === nextAssigneeId) {
      return job._id;
    }

    let assignee: Doc<"users"> | undefined;
    if (nextAssigneeId) {
      const requiredRole = requiredAssignmentRoleForJob(job, servicePlan);
      assignee = await ensureAssigneeEligible(ctx, {
        assigneeId: nextAssigneeId,
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

    await ctx.db.patch(job._id, {
      assigneeId: assignee?._id,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_REASSIGNED",
      metadata: {
        previousAssigneeId: job.assigneeId ?? null,
        nextAssigneeId: assignee?._id ?? null,
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

    let assigneeId = args.assigneeId;
    const notes = args.notes?.trim() || undefined;
    const clientLabel = args.clientLabel?.trim() || undefined;
    const isBackToBack = args.isBackToBack === true;
    const arrivalDeadline = isBackToBack
      ? buildBackToBackArrivalDeadline(args.scheduledStart)
      : args.arrivalDeadline;
    if (assigneeId) {
      const requiredRole = requiredAssignmentRoleForJob(
        {
          jobType: args.jobType,
        },
        null
      );

      const assignee = await ensureAssigneeEligible(ctx, {
        assigneeId,
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
    const { actor, job } = await getJobForAdminUpdate(ctx, args.jobId);

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

    return job._id;
  },
});

