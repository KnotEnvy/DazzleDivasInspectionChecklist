import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";
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

    return await ctx.db.insert("servicePlans", {
      propertyId: args.propertyId,
      planType: args.planType,
      frequency: args.frequency,
      daysOfWeek,
      timeWindowStart: args.timeWindowStart,
      timeWindowEnd: args.timeWindowEnd,
      defaultDurationMinutes: args.defaultDurationMinutes,
      defaultAssigneeRole: args.defaultAssigneeRole,
      priority: args.priority ?? "MEDIUM",
      notes: args.notes,
      customRrule: args.customRrule,
      anchorDate: args.anchorDate ?? Date.now(),
      isActive: true,
    });
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

    if (
      (nextFrequency === "WEEKLY" || nextFrequency === "BIWEEKLY") &&
      (!effectiveDaysOfWeek || effectiveDaysOfWeek.length === 0)
    ) {
      throw new Error("Weekly and biweekly plans require at least one dayOfWeek");
    }

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

export const setActive = mutation({
  args: {
    servicePlanId: v.id("servicePlans"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.servicePlanId, { isActive: args.isActive });
  },
});

