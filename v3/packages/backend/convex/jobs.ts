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

const DAY_MS = 24 * 60 * 60 * 1000;

function isDispatchActiveStatus(status: Doc<"jobs">["status"]) {
  return status !== "COMPLETED" && status !== "CANCELLED";
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

async function hydrateJobs(ctx: QueryCtx, jobs: Array<Doc<"jobs">>) {
  return await Promise.all(
    jobs.map(async (job) => {
      const [property, servicePlan, assignee] = await Promise.all([
        ctx.db.get(job.propertyId),
        job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
        job.assigneeId ? ctx.db.get(job.assigneeId) : Promise.resolve(null),
      ]);
      const checklistType = checklistTypeForJobType(job.jobType);

      return {
        ...job,
        propertyName: property?.name ?? "Unknown property",
        propertyAddress: property?.address ?? "",
        propertyTimezone: property?.timezone ?? "America/New_York",
        propertyServiceNotes: property?.serviceNotes ?? "",
        propertyIsActive: property?.isActive ?? false,
        propertyIsArchived: property?.isArchived === true,
        assigneeName: assignee?.name ?? null,
        servicePlan,
        checklistType,
        canStartChecklist:
          job.assigneeId !== undefined &&
          job.status !== "COMPLETED" &&
          job.status !== "CANCELLED" &&
          checklistType !== null,
      };
    })
  );
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
  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_assignee", (q) => q.eq("assigneeId", params.assigneeId))
    .collect();

  return jobs.find(
    (job) =>
      job._id !== params.excludeJobId &&
      isDispatchActiveStatus(job.status) &&
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
        .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))
        .collect()
        .then((items) =>
          items.filter(
            (job) =>
              job.scheduledStart >= from &&
              job.scheduledStart <= to &&
              (includeCompleted ? true : job.status !== "COMPLETED")
          )
        );
    }

    const filtered = jobs
      .filter((job) => (includeCompleted ? true : job.status !== "COMPLETED"))
      .filter((job) => job.status !== "CANCELLED")
      .sort((a, b) => a.scheduledStart - b.scheduledStart);

    return await hydrateJobs(ctx, filtered);
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

    return await hydrateJobs(ctx, jobs.sort((a, b) => a.scheduledStart - b.scheduledStart));
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

    return await hydrateJobs(ctx, jobs.sort((a, b) => a.scheduledStart - b.scheduledStart));
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

    const [property, servicePlan, assignee, linkedInspection] = await Promise.all([
      ctx.db.get(job.propertyId),
      job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
      job.assigneeId ? ctx.db.get(job.assigneeId) : Promise.resolve(null),
      job.linkedInspectionId ? ctx.db.get(job.linkedInspectionId) : Promise.resolve(null),
    ]);

    const events = await ctx.db
      .query("jobEvents")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    return {
      ...job,
      property,
      servicePlan,
      assignee,
      linkedInspection,
      checklistType: checklistTypeForJobType(job.jobType),
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

      if (isDispatchActiveStatus(job.status)) {
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

      await assertNoAssigneeConflict(ctx, {
        assigneeId: assignee._id,
        scheduledStart: args.scheduledStart,
        scheduledEnd: args.scheduledEnd,
      });
    }

    const jobId = await ctx.db.insert("jobs", {
      propertyId: args.propertyId,
      jobType: args.jobType,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      assigneeId,
      status: "SCHEDULED",
      priority: args.priority ?? "MEDIUM",
      intakeSource: args.intakeSource,
      clientLabel,
      arrivalDeadline: args.arrivalDeadline,
      notes,
      createdById: actor._id,
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
        arrivalDeadline: args.arrivalDeadline ?? null,
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
  },
  handler: async (ctx, args) => {
    const { actor, job } = await getJobForAdminUpdate(ctx, args.jobId);

    if (args.scheduledEnd <= args.scheduledStart) {
      throw new Error("Scheduled end must be after scheduled start");
    }

    if (
      job.assigneeId &&
      isDispatchActiveStatus(job.status) &&
      (job.scheduledStart !== args.scheduledStart || job.scheduledEnd !== args.scheduledEnd)
    ) {
      await assertNoAssigneeConflict(ctx, {
        assigneeId: job.assigneeId,
        scheduledStart: args.scheduledStart,
        scheduledEnd: args.scheduledEnd,
        excludeJobId: job._id,
      });
    }

    await ctx.db.patch(job._id, {
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
    });

    await recordJobEvent(ctx, {
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_RESCHEDULED",
      metadata: {
        previousScheduledStart: job.scheduledStart,
        previousScheduledEnd: job.scheduledEnd,
        nextScheduledStart: args.scheduledStart,
        nextScheduledEnd: args.scheduledEnd,
      },
    });

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
