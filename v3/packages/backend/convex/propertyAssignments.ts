import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { adjustPropertySummaryMetrics } from "./lib/propertySummaries";
import { assignmentRoleValidator } from "./lib/validators";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function propertyAssignmentSummaryDelta(role: Doc<"propertyAssignments">["assignmentRole"]) {
  return role === "CLEANER"
    ? { activeCleanerAssignments: 1 }
    : { activeInspectorAssignments: 1 };
}

export const listByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const userIds = [...new Set(assignments.map((assignment) => assignment.userId))];
    const users = await Promise.all(userIds.map(async (id) => [id, await ctx.db.get(id)] as const));
    const userById = new Map(users);

    return assignments.map((assignment) => ({
      ...assignment,
      user: userById.get(assignment.userId) ?? null,
    }));
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return [];
    }

    const assignmentRole: "CLEANER" | "INSPECTOR" = user.role;

    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_user_role_active", (q) =>
        q
          .eq("userId", user._id)
          .eq("assignmentRole", assignmentRole)
          .eq("isActive", true)
      )
      .collect();

    const propertyIds = [...new Set(assignments.map((assignment) => assignment.propertyId))];
    const properties = await Promise.all(
      propertyIds.map(async (id) => [id, await ctx.db.get(id)] as const)
    );
    const propertyById = new Map(properties);

    return assignments
      .map((assignment) => ({
        ...assignment,
        property: propertyById.get(assignment.propertyId) ?? null,
      }))
      .filter(
        (item) => item.property && item.property.isActive && item.property.isArchived !== true
      );
  },
});

export const assign = mutation({
  args: {
    propertyId: v.id("properties"),
    userId: v.id("users"),
    assignmentRole: assignmentRoleValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property || !property.isActive || property.isArchived === true) {
      throw new Error("Property not found or archived");
    }

    const assignedUser = await ctx.db.get(args.userId);
    if (!assignedUser) {
      throw new Error("User not found");
    }

    if (assignedUser.role !== args.assignmentRole) {
      throw new Error("User role does not match assignment role");
    }

    const existing = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property_user_role_active", (q) =>
        q
          .eq("propertyId", args.propertyId)
          .eq("userId", args.userId)
          .eq("assignmentRole", args.assignmentRole)
          .eq("isActive", true)
      )
      .unique();

    if (existing) {
      throw new Error("User is already assigned in this role");
    }

    const assignmentId = await ctx.db.insert("propertyAssignments", {
      ...args,
      startDate: Date.now(),
      isActive: true,
    });

    await adjustPropertySummaryMetrics(
      ctx,
      args.propertyId,
      propertyAssignmentSummaryDelta(args.assignmentRole)
    );

    return assignmentId;
  },
});

export const unassign = mutation({
  args: { assignmentId: v.id("propertyAssignments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    if (!assignment.isActive) {
      return;
    }

    await ctx.db.patch(args.assignmentId, {
      isActive: false,
      endDate: Date.now(),
    });

    const delta = propertyAssignmentSummaryDelta(assignment.assignmentRole);
    await adjustPropertySummaryMetrics(ctx, assignment.propertyId, {
      activeCleanerAssignments: -(delta.activeCleanerAssignments ?? 0),
      activeInspectorAssignments: -(delta.activeInspectorAssignments ?? 0),
    });
  },
});

