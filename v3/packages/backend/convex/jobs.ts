import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { checklistTypeForJobType } from "./lib/validators";

const DAY_MS = 24 * 60 * 60 * 1000;

async function hydrateJobs(
  ctx: QueryCtx,
  jobs: Array<Doc<"jobs">>
) {
  return await Promise.all(
    jobs.map(async (job) => {
      const [property, servicePlan, assignee] = await Promise.all([
        ctx.db.get(job.propertyId),
        job.servicePlanId ? ctx.db.get(job.servicePlanId) : Promise.resolve(null),
        job.assigneeId ? ctx.db.get(job.assigneeId) : Promise.resolve(null),
      ]);

      return {
        ...job,
        propertyName: property?.name ?? "Unknown property",
        propertyAddress: property?.address ?? "",
        propertyTimezone: property?.timezone ?? "America/New_York",
        propertyServiceNotes: property?.serviceNotes ?? "",
        assigneeName: assignee?.name ?? null,
        servicePlan,
        checklistType: checklistTypeForJobType(job.jobType),
        canStartChecklist:
          job.status !== "COMPLETED" &&
          job.status !== "CANCELLED" &&
          checklistTypeForJobType(job.jobType) !== null,
      };
    })
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
