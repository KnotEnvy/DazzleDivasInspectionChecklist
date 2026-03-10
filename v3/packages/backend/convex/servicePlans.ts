import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";
import { adjustPropertySummaryMetrics } from "./lib/propertySummaries";
import {
  assignmentRoleValidator,
  jobPriorityValidator,
  servicePlanFrequencyValidator,
  servicePlanTypeValidator,
} from "./lib/validators";

function assertTimeWindow(value: string, fieldName: string) {
  const isValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!isValid) {
    throw new Error(`${fieldName} must be in HH:mm format`);
  }
}

function normalizeDaysOfWeek(daysOfWeek: number[] | undefined): number[] | undefined {
  if (!daysOfWeek) {
    return undefined;
  }

  const unique = Array.from(new Set(daysOfWeek)).sort((a, b) => a - b);
  if (unique.some((value) => value < 0 || value > 6)) {
    throw new Error("daysOfWeek must only include values 0-6");
  }

  return unique;
}

async function assertDefaultAssigneeEligible(
  ctx: MutationCtx,
  params: {
    propertyId: Id<"properties">;
    defaultAssigneeRole: "CLEANER" | "INSPECTOR";
    defaultAssigneeId?: Id<"users"> | null;
  }
) {
  if (!params.defaultAssigneeId) {
    return;
  }

  const defaultAssigneeId = params.defaultAssigneeId;
  const user = await ctx.db.get(defaultAssigneeId);
  if (!user) {
    throw new Error("Default assignee not found");
  }

  if (!user.isActive) {
    throw new Error("Default assignee is inactive");
  }

  if (user.role !== params.defaultAssigneeRole) {
    throw new Error(`Default assignee must have role ${params.defaultAssigneeRole}`);
  }

  const assignment = await ctx.db
    .query("propertyAssignments")
    .withIndex("by_property_user_role_active", (q) =>
      q
        .eq("propertyId", params.propertyId)
        .eq("userId", defaultAssigneeId)
        .eq("assignmentRole", params.defaultAssigneeRole)
        .eq("isActive", true)
    )
    .unique();

  if (!assignment) {
    throw new Error("Default assignee must be actively assigned to this property");
  }
}

export const listByProperty = query({
  args: {
    propertyId: v.id("properties"),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const plans = await ctx.db
      .query("servicePlans")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const includeInactive = args.includeInactive === true;
    const filtered = includeInactive ? plans : plans.filter((plan) => plan.isActive);
    return filtered.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const create = mutation({
  args: {
    propertyId: v.id("properties"),
    planType: servicePlanTypeValidator,
    frequency: servicePlanFrequencyValidator,
    daysOfWeek: v.optional(v.array(v.number())),
    timeWindowStart: v.string(),
    timeWindowEnd: v.string(),
    defaultDurationMinutes: v.number(),
    defaultAssigneeRole: assignmentRoleValidator,
    defaultAssigneeId: v.optional(v.id("users")),
    priority: v.optional(jobPriorityValidator),
    notes: v.optional(v.string()),
    customRrule: v.optional(v.string()),
    anchorDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.isArchived === true || !property.isActive) {
      throw new Error("Property not found or archived");
    }

    assertTimeWindow(args.timeWindowStart, "timeWindowStart");
    assertTimeWindow(args.timeWindowEnd, "timeWindowEnd");

    const daysOfWeek = normalizeDaysOfWeek(args.daysOfWeek);
    if (
      (args.frequency === "WEEKLY" || args.frequency === "BIWEEKLY") &&
      (!daysOfWeek || daysOfWeek.length === 0)
    ) {
      throw new Error("Weekly and biweekly plans require at least one dayOfWeek");
    }

    if (args.defaultDurationMinutes <= 0) {
      throw new Error("defaultDurationMinutes must be greater than 0");
    }

    await assertDefaultAssigneeEligible(ctx, {
      propertyId: args.propertyId,
      defaultAssigneeRole: args.defaultAssigneeRole,
      defaultAssigneeId: args.defaultAssigneeId,
    });

    const servicePlanId = await ctx.db.insert("servicePlans", {
      propertyId: args.propertyId,
      planType: args.planType,
      frequency: args.frequency,
      daysOfWeek,
      timeWindowStart: args.timeWindowStart,
      timeWindowEnd: args.timeWindowEnd,
      defaultDurationMinutes: args.defaultDurationMinutes,
      defaultAssigneeRole: args.defaultAssigneeRole,
      defaultAssigneeId: args.defaultAssigneeId,
      priority: args.priority ?? "MEDIUM",
      notes: args.notes,
      customRrule: args.customRrule,
      anchorDate: args.anchorDate ?? Date.now(),
      isActive: true,
    });

    await adjustPropertySummaryMetrics(ctx, args.propertyId, {
      activeServicePlans: 1,
    });

    return servicePlanId;
  },
});

export const update = mutation({
  args: {
    servicePlanId: v.id("servicePlans"),
    planType: v.optional(servicePlanTypeValidator),
    frequency: v.optional(servicePlanFrequencyValidator),
    daysOfWeek: v.optional(v.array(v.number())),
    timeWindowStart: v.optional(v.string()),
    timeWindowEnd: v.optional(v.string()),
    defaultDurationMinutes: v.optional(v.number()),
    defaultAssigneeRole: v.optional(assignmentRoleValidator),
    defaultAssigneeId: v.optional(v.id("users")),
    priority: v.optional(jobPriorityValidator),
    notes: v.optional(v.string()),
    customRrule: v.optional(v.string()),
    anchorDate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.servicePlanId);
    if (!existing) {
      throw new Error("Service plan not found");
    }

    if (args.timeWindowStart !== undefined) {
      assertTimeWindow(args.timeWindowStart, "timeWindowStart");
    }

    if (args.timeWindowEnd !== undefined) {
      assertTimeWindow(args.timeWindowEnd, "timeWindowEnd");
    }

    if (args.defaultDurationMinutes !== undefined && args.defaultDurationMinutes <= 0) {
      throw new Error("defaultDurationMinutes must be greater than 0");
    }

    const normalizedDaysOfWeek =
      args.daysOfWeek === undefined ? undefined : normalizeDaysOfWeek(args.daysOfWeek);
    const nextFrequency = args.frequency ?? existing.frequency;
    const effectiveDaysOfWeek = normalizedDaysOfWeek ?? existing.daysOfWeek;
    const nextDefaultAssigneeRole = args.defaultAssigneeRole ?? existing.defaultAssigneeRole;
    const nextDefaultAssigneeId = args.defaultAssigneeId ?? existing.defaultAssigneeId;

    if (
      (nextFrequency === "WEEKLY" || nextFrequency === "BIWEEKLY") &&
      (!effectiveDaysOfWeek || effectiveDaysOfWeek.length === 0)
    ) {
      throw new Error("Weekly and biweekly plans require at least one dayOfWeek");
    }

    await assertDefaultAssigneeEligible(ctx, {
      propertyId: existing.propertyId,
      defaultAssigneeRole: nextDefaultAssigneeRole,
      defaultAssigneeId: nextDefaultAssigneeId,
    });

    const { servicePlanId, daysOfWeek, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries({
        ...updates,
        ...(daysOfWeek === undefined ? {} : { daysOfWeek: normalizedDaysOfWeek }),
      }).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(servicePlanId, filteredUpdates);
  },
});

export const setDefaultAssignee = mutation({
  args: {
    servicePlanId: v.id("servicePlans"),
    defaultAssigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const plan = await ctx.db.get(args.servicePlanId);
    if (!plan) {
      throw new Error("Service plan not found");
    }

    await assertDefaultAssigneeEligible(ctx, {
      propertyId: plan.propertyId,
      defaultAssigneeRole: plan.defaultAssigneeRole,
      defaultAssigneeId: args.defaultAssigneeId,
    });

    await ctx.db.patch(args.servicePlanId, {
      defaultAssigneeId: args.defaultAssigneeId ?? undefined,
    });
  },
});

export const setActive = mutation({
  args: {
    servicePlanId: v.id("servicePlans"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const plan = await ctx.db.get(args.servicePlanId);
    if (!plan) {
      throw new Error("Service plan not found");
    }

    if (plan.isActive === args.isActive) {
      return;
    }

    await ctx.db.patch(args.servicePlanId, { isActive: args.isActive });
    await adjustPropertySummaryMetrics(ctx, plan.propertyId, {
      activeServicePlans: args.isActive ? 1 : -1,
    });
  },
});
