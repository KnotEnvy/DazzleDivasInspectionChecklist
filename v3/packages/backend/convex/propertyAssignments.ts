import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { assignmentRoleValidator } from "./lib/validators";

export const listByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    return await Promise.all(
      assignments.map(async (assignment) => {
        const user = await ctx.db.get(assignment.userId);
        return { ...assignment, user };
      })
    );
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return [];
    }

    const assignments = await ctx.db
      .query("propertyAssignments")
      .withIndex("by_user_role_active", (q) =>
        q
          .eq("userId", user._id)
          .eq("assignmentRole", user.role)
          .eq("isActive", true)
      )
      .collect();

    return await Promise.all(
      assignments.map(async (assignment) => {
        const property = await ctx.db.get(assignment.propertyId);
        return { ...assignment, property };
      })
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

    return await ctx.db.insert("propertyAssignments", {
      ...args,
      startDate: Date.now(),
      isActive: true,
    });
  },
});

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

