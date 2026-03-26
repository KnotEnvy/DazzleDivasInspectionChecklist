import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  requireAuth,
  requireAdmin,
  assertPropertyAccessForChecklist,
} from "./lib/permissions";
import { getPropertySummaryMetrics } from "./lib/propertySummaries";
import { propertyTypeValidator } from "./lib/validators";

async function enrichPropertiesForAdmin(
  ctx: QueryCtx,
  properties: Array<Doc<"properties">>
) {
  return await Promise.all(
    properties.map(async (property) => {
      const metrics = await getPropertySummaryMetrics(ctx, property);

      return {
        ...property,
        assignmentSummary: {
          cleaners: metrics.activeCleanerAssignments,
          inspectors: metrics.activeInspectorAssignments,
        },
        scheduleSummary: {
          activePlans: metrics.activeServicePlans,
        },
      };
    })
  );
}

async function listAdminProperties(ctx: QueryCtx, includeArchived: boolean) {
  const properties = await ctx.db.query("properties").collect();
  const filtered = includeArchived
    ? properties
    : properties.filter((property) => property.isArchived !== true);

  return await enrichPropertiesForAdmin(ctx, filtered);
}

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      const properties = await ctx.db
        .query("properties")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      return properties.filter((property) => property.isArchived !== true);
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

    const properties = await Promise.all(
      assignments.map(async (assignment) => {
        return await ctx.db.get(assignment.propertyId);
      })
    );

    return properties.filter((property): property is NonNullable<typeof property> => {
      return !!property && property.isActive && property.isArchived !== true;
    });
  },
});

export const listAdmin = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await listAdminProperties(ctx, args.includeArchived === true);
  },
});

export const listAll = listAdmin;

export const search = query({
  args: {
    term: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const term = args.term.trim();
    if (term.length === 0) {
      return await listAdminProperties(ctx, args.includeArchived === true);
    }

    const includeArchived = args.includeArchived === true;
    const [nameMatches, addressMatches] = await Promise.all([
      ctx.db
        .query("properties")
        .withSearchIndex("search_name", (q) => q.search("name", term))
        .take(50),
      ctx.db
        .query("properties")
        .withSearchIndex("search_address", (q) => q.search("address", term))
        .take(50),
    ]);

    const candidatesById = new Map(
      [...nameMatches, ...addressMatches].map((property) => [property._id, property])
    );

    const candidates = Array.from(candidatesById.values()).filter((property) =>
      includeArchived ? true : property.isArchived !== true
    );

    return await enrichPropertiesForAdmin(ctx, candidates);
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
    clientLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    propertyType: propertyTypeValidator,
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accessInstructions: v.optional(v.string()),
    entryMethod: v.optional(v.string()),
    serviceNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const clientLabel = args.clientLabel?.trim() || undefined;

    return await ctx.db.insert("properties", {
      name: args.name,
      address: args.address,
      propertyType: args.propertyType,
      timezone: args.timezone ?? "America/New_York",
      activeCleanerAssignments: 0,
      activeInspectorAssignments: 0,
      activeServicePlans: 0,
      isArchived: false,
      isActive: true,
      ...(clientLabel ? { clientLabel } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.bedrooms !== undefined ? { bedrooms: args.bedrooms } : {}),
      ...(args.bathrooms !== undefined ? { bathrooms: args.bathrooms } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
      ...(args.accessInstructions !== undefined
        ? { accessInstructions: args.accessInstructions }
        : {}),
      ...(args.entryMethod !== undefined ? { entryMethod: args.entryMethod } : {}),
      ...(args.serviceNotes !== undefined ? { serviceNotes: args.serviceNotes } : {}),
    });
  },
});

export const update = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    clientLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    propertyType: v.optional(propertyTypeValidator),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    notes: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accessInstructions: v.optional(v.string()),
    entryMethod: v.optional(v.string()),
    serviceNotes: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { propertyId, clientLabel, ...updates } = args;
    const normalizedUpdates = {
      ...updates,
      ...(clientLabel !== undefined ? { clientLabel: clientLabel.trim() || undefined } : {}),
    };
    const filteredUpdates = Object.fromEntries(
      Object.entries(normalizedUpdates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(propertyId, filteredUpdates);
  },
});

export const archive = mutation({
  args: {
    propertyId: v.id("properties"),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const isArchived = args.isArchived ?? true;
    await ctx.db.patch(args.propertyId, {
      isArchived,
      isActive: !isArchived,
    });
  },
});

