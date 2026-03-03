import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";
import { propertyTypeValidator } from "./lib/validators";

/**
 * List all active properties.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * List all properties including inactive (admin only).
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("properties").collect();
  },
});

/**
 * Get a single property by ID.
 */
export const getById = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.propertyId);
  },
});

/**
 * Create a new property (admin only).
 */
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

/**
 * Update a property (admin only).
 */
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
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(propertyId, filtered);
  },
});
