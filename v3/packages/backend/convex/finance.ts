import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";
import {
  calculateCleanerPayroll,
  calculateGrossMargin,
  deriveRoomComboUnitsFromProperty,
  roundCurrency,
} from "./lib/finance";

const DAY_MS = 24 * 60 * 60 * 1000;

const optionalCurrencyValidator = v.optional(v.union(v.number(), v.null()));
const workerRoleValidator = v.union(v.literal("CLEANER"), v.literal("INSPECTOR"));
const jobFinancialStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("PENDING_REVIEW"),
  v.literal("APPROVED")
);

type FinanceJobStatus = "FORECAST" | "PENDING_REVIEW" | "APPROVED";

type DerivedFinanceSnapshot = {
  financeStatus: FinanceJobStatus;
  revenueAmount?: number;
  roomComboUnits?: number;
  perRoomComboRate?: number;
  unitBonus?: number;
  payrollAmount?: number;
  grossMargin?: number;
  missingFields: string[];
  warnings: string[];
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? undefined : roundCurrency(value);
}

function isCleaningJob(job: Pick<Doc<"jobs">, "jobType">) {
  return job.jobType === "CLEANING";
}

async function getPropertyConfigByPropertyId(ctx: QueryCtx | MutationCtx, propertyId: Id<"properties">) {
  const configs = await ctx.db
    .query("financePropertyConfigs")
    .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
    .collect();

  return configs.sort((left, right) => right._creationTime - left._creationTime)[0] ?? null;
}

async function getJobFinancialByJobId(ctx: QueryCtx | MutationCtx, jobId: Id<"jobs">) {
  const records = await ctx.db
    .query("jobFinancials")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();

  return records.sort((left, right) => right._creationTime - left._creationTime)[0] ?? null;
}

async function getLinkedJobForInspection(ctx: QueryCtx | MutationCtx, inspectionId: Id<"inspections">) {
  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_linked_inspection", (q) => q.eq("linkedInspectionId", inspectionId))
    .collect();

  return jobs.sort((left, right) => right._creationTime - left._creationTime)[0] ?? null;
}

async function getActiveWorkerPayProfile(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined,
  role: "CLEANER" | "INSPECTOR",
  atTime: number
) {
  if (!userId) {
    return null;
  }

  const profiles = await ctx.db
    .query("workerPayProfiles")
    .withIndex("by_user_role_active", (q) =>
      q.eq("userId", userId).eq("role", role).eq("isActive", true)
    )
    .collect();

  return (
    profiles
      .filter(
        (profile) =>
          profile.effectiveStart <= atTime &&
          (profile.effectiveEnd === undefined || profile.effectiveEnd >= atTime)
      )
      .sort((left, right) => right.effectiveStart - left.effectiveStart)[0] ?? null
  );
}

function buildDerivedFinanceSnapshot(params: {
  job: Doc<"jobs">;
  property: Doc<"properties"> | null;
  propertyConfig: Doc<"financePropertyConfigs"> | null;
  workerPayProfile: Doc<"workerPayProfiles"> | null;
  jobFinancial: Doc<"jobFinancials"> | null;
}): DerivedFinanceSnapshot {
  const { job, property, propertyConfig, workerPayProfile, jobFinancial } = params;
  const roomComboUnits =
    jobFinancial?.roomComboUnitsSnapshot ??
    propertyConfig?.roomComboUnits ??
    deriveRoomComboUnitsFromProperty({
      bedrooms: property?.bedrooms,
      bathrooms: property?.bathrooms,
    });
  const revenueAmount =
    jobFinancial?.revenueAmountSnapshot ?? propertyConfig?.cleaningRevenuePerJob;
  const perRoomComboRate =
    jobFinancial?.perRoomComboRateSnapshot ?? workerPayProfile?.perRoomComboRate;
  const unitBonus = jobFinancial?.unitBonusSnapshot ?? workerPayProfile?.unitBonus;
  const payrollAmount =
    jobFinancial?.payrollAmountSnapshot ??
    calculateCleanerPayroll({
      roomComboUnits,
      perRoomComboRate,
      unitBonus,
    });
  const grossMargin = calculateGrossMargin(revenueAmount, payrollAmount);

  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!propertyConfig) {
    warnings.push("Property finance settings have not been saved yet.");
  }

  if (job.assigneeId && !workerPayProfile) {
    warnings.push("Cleaner pay profile is missing for the assigned worker.");
  }

  if (revenueAmount === undefined) {
    missingFields.push("Revenue amount");
  }
  if (roomComboUnits === undefined) {
    missingFields.push("Room combo units");
  }
  if (perRoomComboRate === undefined) {
    missingFields.push("Per-room combo rate");
  }
  if (unitBonus === undefined) {
    missingFields.push("Unit bonus");
  }
  if (payrollAmount === undefined) {
    missingFields.push("Payroll amount");
  }

  const financeStatus: FinanceJobStatus =
    jobFinancial?.status === "APPROVED"
      ? "APPROVED"
      : job.status === "COMPLETED"
        ? "PENDING_REVIEW"
        : "FORECAST";

  return {
    financeStatus,
    revenueAmount,
    roomComboUnits,
    perRoomComboRate,
    unitBonus,
    payrollAmount,
    grossMargin,
    missingFields,
    warnings,
  };
}

async function recordFinanceEvent(
  ctx: MutationCtx,
  params: {
    jobFinancialId: Id<"jobFinancials">;
    jobId: Id<"jobs">;
    actorId: Id<"users">;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.db.insert("financeEvents", {
    jobFinancialId: params.jobFinancialId,
    jobId: params.jobId,
    actorId: params.actorId,
    eventType: params.eventType,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    createdAt: Date.now(),
  });
}

async function upsertJobFinancialRecord(
  ctx: MutationCtx,
  params: {
    existing: Doc<"jobFinancials"> | null;
    job: Doc<"jobs">;
    values: {
      revenueAmountSnapshot?: number;
      roomComboUnitsSnapshot?: number;
      perRoomComboRateSnapshot?: number;
      unitBonusSnapshot?: number;
      payrollAmountSnapshot?: number;
      adminNotes?: string;
      status: Doc<"jobFinancials">["status"];
      approvedAt?: number;
      approvedById?: Id<"users">;
      unlockedAt?: number;
      unlockedById?: Id<"users">;
      unlockReason?: string;
    };
  }
) {
  const { existing, job, values } = params;
  const payload = {
    propertyId: job.propertyId,
    inspectionId: job.linkedInspectionId,
    assigneeId: job.assigneeId,
    jobType: job.jobType,
    financialScope: "CLEANING" as const,
    revenueAmountSnapshot: values.revenueAmountSnapshot,
    roomComboUnitsSnapshot: values.roomComboUnitsSnapshot,
    perRoomComboRateSnapshot: values.perRoomComboRateSnapshot,
    unitBonusSnapshot: values.unitBonusSnapshot,
    payrollAmountSnapshot: values.payrollAmountSnapshot,
    adminNotes: values.adminNotes,
    status: values.status,
    approvedAt: values.approvedAt,
    approvedById: values.approvedById,
    unlockedAt: values.unlockedAt,
    unlockedById: values.unlockedById,
    unlockReason: values.unlockReason,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("jobFinancials", {
    jobId: job._id,
    ...payload,
  });
}

async function loadFinanceRows(
  ctx: QueryCtx,
  jobs: Array<Doc<"jobs">>
) {
  const relevantJobs = jobs.filter(isCleaningJob);
  const propertyIds = [...new Set(relevantJobs.map((job) => job.propertyId))];
  const assigneeIds = [...new Set(relevantJobs.map((job) => job.assigneeId).filter(isDefined))];
  const [properties, users, propertyConfigs, jobFinancials] = await Promise.all([
    Promise.all(propertyIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
    Promise.all(assigneeIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
    Promise.all(propertyIds.map(async (id) => [id, await getPropertyConfigByPropertyId(ctx, id)] as const)),
    Promise.all(relevantJobs.map(async (job) => [job._id, await getJobFinancialByJobId(ctx, job._id)] as const)),
  ]);

  const workerProfiles = await Promise.all(
    assigneeIds.map(async (userId) => [
      userId,
      await getActiveWorkerPayProfile(ctx, userId, "CLEANER", Date.now()),
    ] as const)
  );

  const propertyById = new Map(properties);
  const userById = new Map(users);
  const propertyConfigById = new Map(propertyConfigs);
  const jobFinancialByJobId = new Map(jobFinancials);
  const workerPayProfileByUserId = new Map(workerProfiles);

  return relevantJobs.map((job) => {
    const property = propertyById.get(job.propertyId) ?? null;
    const user = job.assigneeId ? (userById.get(job.assigneeId) ?? null) : null;
    const propertyConfig = propertyConfigById.get(job.propertyId) ?? null;
    const jobFinancial = jobFinancialByJobId.get(job._id) ?? null;
    const workerPayProfile = job.assigneeId
      ? (workerPayProfileByUserId.get(job.assigneeId) ?? null)
      : null;
    const snapshot = buildDerivedFinanceSnapshot({
      job,
      property,
      propertyConfig,
      workerPayProfile,
      jobFinancial,
    });

    return {
      jobId: job._id,
      inspectionId: job.linkedInspectionId,
      propertyId: job.propertyId,
      propertyName: property?.name ?? "Unknown property",
      clientLabel: property?.clientLabel ?? undefined,
      assigneeId: job.assigneeId,
      assigneeName: user?.name ?? "Unassigned",
      scheduledStart: job.scheduledStart,
      completedAt: job.completedAt,
      jobStatus: job.status,
      financeStatus: snapshot.financeStatus,
      revenueAmount: snapshot.revenueAmount,
      roomComboUnits: snapshot.roomComboUnits,
      perRoomComboRate: snapshot.perRoomComboRate,
      unitBonus: snapshot.unitBonus,
      payrollAmount: snapshot.payrollAmount,
      grossMargin: snapshot.grossMargin,
      missingFields: snapshot.missingFields,
      warnings: snapshot.warnings,
      approvedAt: jobFinancial?.approvedAt,
      hasSavedDraft: jobFinancial !== null,
    };
  });
}

export const listPropertyConfigs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const configs = await ctx.db.query("financePropertyConfigs").collect();
    return configs.sort((left, right) => left._creationTime - right._creationTime);
  },
});

export const upsertPropertyConfig = mutation({
  args: {
    propertyId: v.id("properties"),
    cleaningRevenuePerJob: v.number(),
    roomComboUnits: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const property = await ctx.db.get(args.propertyId);

    if (!property) {
      throw new Error("Property not found");
    }

    if (args.cleaningRevenuePerJob <= 0) {
      throw new Error("Cleaning revenue per job must be greater than 0");
    }

    if (args.roomComboUnits <= 0) {
      throw new Error("Room combo units must be greater than 0");
    }

    const existing = await getPropertyConfigByPropertyId(ctx, args.propertyId);
    const notes = args.notes?.trim() || undefined;
    const payload = {
      cleaningRevenuePerJob: roundCurrency(args.cleaningRevenuePerJob),
      roomComboUnits: roundCurrency(args.roomComboUnits),
      notes,
      updatedAt: Date.now(),
      updatedById: actor._id,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("financePropertyConfigs", {
      propertyId: args.propertyId,
      ...payload,
    });
  },
});

export const listWorkerPayProfiles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const profiles = await ctx.db.query("workerPayProfiles").collect();
    const activeProfiles = profiles.filter((profile) => profile.isActive);
    const latestByUserRole = new Map<string, (typeof activeProfiles)[number]>();

    for (const profile of activeProfiles) {
      const key = `${profile.userId}:${profile.role}`;
      const existing = latestByUserRole.get(key);
      if (!existing || existing.effectiveStart < profile.effectiveStart) {
        latestByUserRole.set(key, profile);
      }
    }

    return Array.from(latestByUserRole.values()).sort(
      (left, right) => left.effectiveStart - right.effectiveStart
    );
  },
});

export const upsertWorkerPayProfile = mutation({
  args: {
    userId: v.id("users"),
    role: workerRoleValidator,
    perRoomComboRate: v.number(),
    unitBonus: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error("Worker not found");
    }

    if (args.perRoomComboRate <= 0) {
      throw new Error("Per-room combo rate must be greater than 0");
    }

    if (args.unitBonus < 0) {
      throw new Error("Unit bonus cannot be negative");
    }

    const profiles = await ctx.db
      .query("workerPayProfiles")
      .withIndex("by_user_role_active", (q) =>
        q.eq("userId", args.userId).eq("role", args.role).eq("isActive", true)
      )
      .collect();

    const latest = profiles.sort((left, right) => right.effectiveStart - left.effectiveStart)[0];
    const effectiveStart = latest?.effectiveStart ?? Date.now();
    const payload = {
      perRoomComboRate: roundCurrency(args.perRoomComboRate),
      unitBonus: roundCurrency(args.unitBonus),
      updatedAt: Date.now(),
      updatedById: actor._id,
      isActive: true,
    };

    for (const profile of profiles.slice(1)) {
      await ctx.db.patch(profile._id, {
        isActive: false,
        effectiveEnd: Date.now(),
        updatedAt: Date.now(),
        updatedById: actor._id,
      });
    }

    if (latest) {
      await ctx.db.patch(latest._id, payload);
      return latest._id;
    }

    return await ctx.db.insert("workerPayProfiles", {
      userId: args.userId,
      role: args.role,
      perRoomComboRate: payload.perRoomComboRate,
      unitBonus: payload.unitBonus,
      effectiveStart,
      isActive: true,
      updatedAt: payload.updatedAt,
      updatedById: actor._id,
    });
  },
});

export const getInspectionReview = query({
  args: {
    inspectionId: v.id("inspections"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) {
      return null;
    }

    const job = await getLinkedJobForInspection(ctx, args.inspectionId);
    if (!job || !isCleaningJob(job)) {
      return null;
    }

    const [property, jobFinancial, propertyConfig, workerPayProfile] = await Promise.all([
      ctx.db.get(job.propertyId),
      getJobFinancialByJobId(ctx, job._id),
      getPropertyConfigByPropertyId(ctx, job.propertyId),
      getActiveWorkerPayProfile(ctx, job.assigneeId, "CLEANER", Date.now()),
    ]);
    const snapshot = buildDerivedFinanceSnapshot({
      job,
      property,
      propertyConfig,
      workerPayProfile,
      jobFinancial,
    });

    return {
      jobId: job._id,
      inspectionId: inspection._id,
      propertyName: inspection.propertyName,
      assigneeName: inspection.assigneeName,
      scheduledStart: job.scheduledStart,
      completedAt: job.completedAt ?? inspection.completedAt,
      jobStatus: job.status,
      financeStatus: snapshot.financeStatus,
      revenueAmount: snapshot.revenueAmount,
      roomComboUnits: snapshot.roomComboUnits,
      perRoomComboRate: snapshot.perRoomComboRate,
      unitBonus: snapshot.unitBonus,
      payrollAmount: snapshot.payrollAmount,
      grossMargin: snapshot.grossMargin,
      missingFields: snapshot.missingFields,
      warnings: snapshot.warnings,
      adminNotes: jobFinancial?.adminNotes ?? "",
      approvedAt: jobFinancial?.approvedAt,
      approvedById: jobFinancial?.approvedById,
      unlockReason: jobFinancial?.unlockReason,
      canApprove:
        inspection.status === "COMPLETED" &&
        job.status === "COMPLETED" &&
        snapshot.missingFields.length === 0,
    };
  },
});

export const saveJobFinancialDraft = mutation({
  args: {
    jobId: v.id("jobs"),
    revenueAmount: optionalCurrencyValidator,
    roomComboUnits: optionalCurrencyValidator,
    perRoomComboRate: optionalCurrencyValidator,
    unitBonus: optionalCurrencyValidator,
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || !isCleaningJob(job)) {
      throw new Error("Cleaning job not found");
    }

    const existing = await getJobFinancialByJobId(ctx, job._id);
    if (existing?.status === "APPROVED") {
      throw new Error("Unlock this finance record before editing it");
    }

    const [property, propertyConfig, workerPayProfile] = await Promise.all([
      ctx.db.get(job.propertyId),
      getPropertyConfigByPropertyId(ctx, job.propertyId),
      getActiveWorkerPayProfile(ctx, job.assigneeId, "CLEANER", Date.now()),
    ]);
    const snapshot = buildDerivedFinanceSnapshot({
      job,
      property,
      propertyConfig,
      workerPayProfile,
      jobFinancial: existing,
    });

    const roomComboUnits = normalizeOptionalNumber(args.roomComboUnits) ?? snapshot.roomComboUnits;
    const perRoomComboRate =
      normalizeOptionalNumber(args.perRoomComboRate) ?? snapshot.perRoomComboRate;
    const unitBonus = normalizeOptionalNumber(args.unitBonus) ?? snapshot.unitBonus;
    const revenueAmount = normalizeOptionalNumber(args.revenueAmount) ?? snapshot.revenueAmount;
    const payrollAmount = calculateCleanerPayroll({
      roomComboUnits,
      perRoomComboRate,
      unitBonus,
    });

    const jobFinancialId = await upsertJobFinancialRecord(ctx, {
      existing,
      job,
      values: {
        revenueAmountSnapshot: revenueAmount,
        roomComboUnitsSnapshot: roomComboUnits,
        perRoomComboRateSnapshot: perRoomComboRate,
        unitBonusSnapshot: unitBonus,
        payrollAmountSnapshot: payrollAmount,
        adminNotes: args.adminNotes?.trim() || undefined,
        status: job.status === "COMPLETED" ? "PENDING_REVIEW" : "DRAFT",
      },
    });

    await recordFinanceEvent(ctx, {
      jobFinancialId,
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_FINANCE_DRAFT_SAVED",
      metadata: {
        jobStatus: job.status,
      },
    });

    return jobFinancialId;
  },
});

export const approveJobFinancial = mutation({
  args: {
    jobId: v.id("jobs"),
    revenueAmount: optionalCurrencyValidator,
    roomComboUnits: optionalCurrencyValidator,
    perRoomComboRate: optionalCurrencyValidator,
    unitBonus: optionalCurrencyValidator,
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || !isCleaningJob(job)) {
      throw new Error("Cleaning job not found");
    }

    if (job.status !== "COMPLETED") {
      throw new Error("Only completed jobs can be approved for finance");
    }

    const existing = await getJobFinancialByJobId(ctx, job._id);
    const [property, propertyConfig, workerPayProfile] = await Promise.all([
      ctx.db.get(job.propertyId),
      getPropertyConfigByPropertyId(ctx, job.propertyId),
      getActiveWorkerPayProfile(ctx, job.assigneeId, "CLEANER", Date.now()),
    ]);
    const snapshot = buildDerivedFinanceSnapshot({
      job,
      property,
      propertyConfig,
      workerPayProfile,
      jobFinancial: existing,
    });

    const roomComboUnits = normalizeOptionalNumber(args.roomComboUnits) ?? snapshot.roomComboUnits;
    const perRoomComboRate =
      normalizeOptionalNumber(args.perRoomComboRate) ?? snapshot.perRoomComboRate;
    const unitBonus = normalizeOptionalNumber(args.unitBonus) ?? snapshot.unitBonus;
    const revenueAmount = normalizeOptionalNumber(args.revenueAmount) ?? snapshot.revenueAmount;
    const payrollAmount = calculateCleanerPayroll({
      roomComboUnits,
      perRoomComboRate,
      unitBonus,
    });

    if (
      revenueAmount === undefined ||
      roomComboUnits === undefined ||
      perRoomComboRate === undefined ||
      unitBonus === undefined ||
      payrollAmount === undefined
    ) {
      throw new Error("Revenue, units, rate, bonus, and payroll must all be set before approval");
    }

    const approvedAt = Date.now();
    const jobFinancialId = await upsertJobFinancialRecord(ctx, {
      existing,
      job,
      values: {
        revenueAmountSnapshot: revenueAmount,
        roomComboUnitsSnapshot: roomComboUnits,
        perRoomComboRateSnapshot: perRoomComboRate,
        unitBonusSnapshot: unitBonus,
        payrollAmountSnapshot: payrollAmount,
        adminNotes: args.adminNotes?.trim() || existing?.adminNotes,
        status: "APPROVED",
        approvedAt,
        approvedById: actor._id,
        unlockedAt: undefined,
        unlockedById: undefined,
        unlockReason: undefined,
      },
    });

    await recordFinanceEvent(ctx, {
      jobFinancialId,
      jobId: job._id,
      actorId: actor._id,
      eventType: "JOB_FINANCE_APPROVED",
      metadata: {
        approvedAt,
      },
    });

    return jobFinancialId;
  },
});

export const unlockJobFinancial = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const existing = await getJobFinancialByJobId(ctx, args.jobId);

    if (!existing || existing.status !== "APPROVED") {
      throw new Error("Finance approval not found for this job");
    }

    const reason = args.reason.trim();
    if (reason.length === 0) {
      throw new Error("Unlock reason is required");
    }

    await ctx.db.patch(existing._id, {
      status: "PENDING_REVIEW",
      unlockedAt: Date.now(),
      unlockedById: actor._id,
      unlockReason: reason,
      updatedAt: Date.now(),
    });

    await recordFinanceEvent(ctx, {
      jobFinancialId: existing._id,
      jobId: existing.jobId,
      actorId: actor._id,
      eventType: "JOB_FINANCE_UNLOCKED",
      metadata: {
        reason,
      },
    });

    return existing._id;
  },
});

export const getOverview = query({
  args: {
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const jobs = (await ctx.db
      .query("jobs")
      .withIndex("by_scheduled_start", (q) => q.gte("scheduledStart", args.from).lte("scheduledStart", args.to))
      .collect()).filter((job) => isCleaningJob(job) && job.status !== "CANCELLED");

    const rows = await loadFinanceRows(ctx, jobs);
    let forecastRevenue = 0;
    let upcomingForecastRevenue = 0;
    let pendingReviewRevenue = 0;
    let realizedRevenue = 0;
    let approvedPayroll = 0;
    let grossMargin = 0;
    let pendingReviewCount = 0;

    for (const row of rows) {
      if (row.financeStatus === "APPROVED") {
        realizedRevenue += row.revenueAmount ?? 0;
        approvedPayroll += row.payrollAmount ?? 0;
        grossMargin += row.grossMargin ?? 0;
        continue;
      }

      forecastRevenue += row.revenueAmount ?? 0;

      if (row.jobStatus === "COMPLETED") {
        pendingReviewRevenue += row.revenueAmount ?? 0;
        pendingReviewCount += 1;
      } else {
        upcomingForecastRevenue += row.revenueAmount ?? 0;
      }
    }

    return {
      forecastRevenue: roundCurrency(forecastRevenue),
      upcomingForecastRevenue: roundCurrency(upcomingForecastRevenue),
      pendingReviewRevenue: roundCurrency(pendingReviewRevenue),
      realizedRevenue: roundCurrency(realizedRevenue),
      approvedPayroll: roundCurrency(approvedPayroll),
      grossMargin: roundCurrency(grossMargin),
      pendingReviewCount,
      totalCleaningJobs: rows.length,
    };
  },
});

export const listJobs = query({
  args: {
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scheduled_start", (q) => q.gte("scheduledStart", args.from).lte("scheduledStart", args.to))
      .collect();

    const rows = await loadFinanceRows(ctx, jobs);
    return rows.sort((left, right) => right.scheduledStart - left.scheduledStart);
  },
});

export const listRevenue = query({
  args: {
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scheduled_start", (q) => q.gte("scheduledStart", args.from).lte("scheduledStart", args.to))
      .collect();

    const rows = await loadFinanceRows(ctx, jobs);
    const propertySummaries = new Map<string, {
      propertyId: Id<"properties">;
      propertyName: string;
      forecastRevenue: number;
      pendingReviewRevenue: number;
      realizedRevenue: number;
      approvedPayroll: number;
      grossMargin: number;
      jobCount: number;
    }>();

    for (const row of rows) {
      const existing = propertySummaries.get(String(row.propertyId)) ?? {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        forecastRevenue: 0,
        pendingReviewRevenue: 0,
        realizedRevenue: 0,
        approvedPayroll: 0,
        grossMargin: 0,
        jobCount: 0,
      };

      existing.jobCount += 1;
      if (row.financeStatus === "APPROVED") {
        existing.realizedRevenue += row.revenueAmount ?? 0;
        existing.approvedPayroll += row.payrollAmount ?? 0;
        existing.grossMargin += row.grossMargin ?? 0;
      } else if (row.jobStatus === "COMPLETED") {
        existing.pendingReviewRevenue += row.revenueAmount ?? 0;
      } else {
        existing.forecastRevenue += row.revenueAmount ?? 0;
      }

      propertySummaries.set(String(row.propertyId), existing);
    }

    return Array.from(propertySummaries.values())
      .map((summary) => ({
        ...summary,
        forecastRevenue: roundCurrency(summary.forecastRevenue),
        pendingReviewRevenue: roundCurrency(summary.pendingReviewRevenue),
        realizedRevenue: roundCurrency(summary.realizedRevenue),
        approvedPayroll: roundCurrency(summary.approvedPayroll),
        grossMargin: roundCurrency(summary.grossMargin),
      }))
      .sort((left, right) => right.realizedRevenue - left.realizedRevenue);
  },
});

export const listPayroll = query({
  args: {
    weekStart: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const weekEnd = args.weekStart + 7 * DAY_MS;
    const financials = (await ctx.db
      .query("jobFinancials")
      .withIndex("by_status", (q) => q.eq("status", "APPROVED"))
      .collect()).filter((financial) => financial.financialScope === "CLEANING");

    const jobs = await Promise.all(financials.map((financial) => ctx.db.get(financial.jobId)));
    const relevantPairs = financials
      .map((financial, index) => ({ financial, job: jobs[index] }))
      .filter(
        (pair): pair is { financial: typeof financials[number]; job: Doc<"jobs"> } =>
          !!pair.job &&
          isCleaningJob(pair.job) &&
          (pair.job.completedAt ?? 0) >= args.weekStart &&
          (pair.job.completedAt ?? 0) < weekEnd
      );

    const assigneeIds = [...new Set(relevantPairs.map((pair) => pair.job.assigneeId).filter(isDefined))];
    const propertyIds = [...new Set(relevantPairs.map((pair) => pair.job.propertyId))];
    const [users, properties] = await Promise.all([
      Promise.all(assigneeIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
      Promise.all(propertyIds.map(async (id) => [id, await ctx.db.get(id)] as const)),
    ]);
    const userById = new Map(users);
    const propertyById = new Map(properties);

    const payrollByAssignee = new Map<string, {
      assigneeId: Id<"users">;
      assigneeName: string;
      totalPayroll: number;
      totalRevenue: number;
      grossMargin: number;
      jobs: Array<{
        jobId: Id<"jobs">;
        inspectionId?: Id<"inspections">;
        propertyName: string;
        completedAt?: number;
        roomComboUnits?: number;
        perRoomComboRate?: number;
        unitBonus?: number;
        payrollAmount?: number;
        revenueAmount?: number;
      }>;
    }>();

    for (const pair of relevantPairs) {
      if (!pair.job.assigneeId) {
        continue;
      }

      const key = String(pair.job.assigneeId);
      const entry = payrollByAssignee.get(key) ?? {
        assigneeId: pair.job.assigneeId,
        assigneeName: userById.get(pair.job.assigneeId)?.name ?? "Unknown worker",
        totalPayroll: 0,
        totalRevenue: 0,
        grossMargin: 0,
        jobs: [],
      };

      entry.totalPayroll += pair.financial.payrollAmountSnapshot ?? 0;
      entry.totalRevenue += pair.financial.revenueAmountSnapshot ?? 0;
      entry.grossMargin += calculateGrossMargin(
        pair.financial.revenueAmountSnapshot,
        pair.financial.payrollAmountSnapshot
      ) ?? 0;
      entry.jobs.push({
        jobId: pair.job._id,
        inspectionId: pair.job.linkedInspectionId,
        propertyName: propertyById.get(pair.job.propertyId)?.name ?? "Unknown property",
        completedAt: pair.job.completedAt,
        roomComboUnits: pair.financial.roomComboUnitsSnapshot,
        perRoomComboRate: pair.financial.perRoomComboRateSnapshot,
        unitBonus: pair.financial.unitBonusSnapshot,
        payrollAmount: pair.financial.payrollAmountSnapshot,
        revenueAmount: pair.financial.revenueAmountSnapshot,
      });

      payrollByAssignee.set(key, entry);
    }

    return Array.from(payrollByAssignee.values())
      .map((entry) => ({
        ...entry,
        totalPayroll: roundCurrency(entry.totalPayroll),
        totalRevenue: roundCurrency(entry.totalRevenue),
        grossMargin: roundCurrency(entry.grossMargin),
        jobs: entry.jobs.sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0)),
      }))
      .sort((left, right) => right.totalPayroll - left.totalPayroll);
  },
});
