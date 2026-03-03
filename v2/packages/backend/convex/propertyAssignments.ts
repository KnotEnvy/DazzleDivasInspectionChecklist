import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";

/**
 * List assignments for a property.
 */
export const listByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    // Enrich with inspector data
    return await Promise.all(
      assignments.map(async (a) => {
        const inspector = await ctx.db.get(a.inspectorId);
        return { ...a, inspector };
      })
    );
  },
});

/**
 * List properties assigned to the current inspector.
 */
export const listMyAssignments = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_inspector", (q) => q.eq("inspectorId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return await Promise.all(
      assignments.map(async (a) => {
        const property = await ctx.db.get(a.propertyId);
        return { ...a, property };
      })
    );
  },
});

/**
 * Assign an inspector to a property (admin only).
 */
export const assign = mutation({
  args: {
    propertyId: v.id("properties"),
    inspectorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if assignment already exists
    const existing = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property_inspector", (q) =>
        q.eq("propertyId", args.propertyId).eq("inspectorId", args.inspectorId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (existing) {
      throw new Error("Inspector is already assigned to this property");
    }

    return await ctx.db.insert("propertyAssignments", {
      propertyId: args.propertyId,
      inspectorId: args.inspectorId,
      startDate: Date.now(),
      isActive: true,
    });
  },
});

/**
 * Remove an assignment (admin only).
 */
export const unassign = mutation({
  args: { assignmentId: v.id("propertyAssignments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.assignmentId, {
      isActive: false,
      endDate: Date.now(),
    });
  },
});
