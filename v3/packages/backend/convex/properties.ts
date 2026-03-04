import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireAuth,
  requireAdmin,
  assertPropertyAccessForChecklist,
} from "./lib/permissions";
import { propertyTypeValidator } from "./lib/validators";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return await ctx.db
        .query("properties")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
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

    const properties = await Promise.all(
      assignments.map(async (assignment) => {
        return await ctx.db.get(assignment.propertyId);
      })
    );

    return properties.filter((property): property is NonNullable<typeof property> => {
      return !!property && property.isActive;
    });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("properties").collect();
  },
});

export const getById = query({
  args: {
    propertyId: v.id("properties"),
    checklistType: v.optional(v.union(v.literal("CLEANING"), v.literal("INSPECTION"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const property = await ctx.db.get(args.propertyId);

    if (!property) {
      return null;
    }

    if (user.role !== "ADMIN") {
      const checklistType =
        args.checklistType ?? (user.role === "CLEANER" ? "CLEANING" : "INSPECTION");

      await assertPropertyAccessForChecklist(
        ctx,
        user,
        args.propertyId,
        checklistType
      );
    }

    return property;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    address: v.string(),
    description: v.optional(v.string()),
    propertyType: propertyTypeValidator,
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("properties", {
      ...args,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    description: v.optional(v.string()),
    propertyType: v.optional(propertyTypeValidator),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { propertyId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(propertyId, filteredUpdates);
  },
});

