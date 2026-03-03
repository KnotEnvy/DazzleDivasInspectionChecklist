import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./lib/permissions";

/**
 * List active (in-progress) inspections for the current user.
 * Admins see all; inspectors see only their own.
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return await ctx.db
        .query("inspections")
        .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
        .collect();
    }

    return await ctx.db
      .query("inspections")
      .withIndex("by_inspector_status", (q) =>
        q.eq("inspectorId", user._id).eq("status", "IN_PROGRESS")
      )
      .collect();
  },
});

/**
 * List completed inspections (for history).
 */
export const listCompleted = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    if (user.role === "ADMIN") {
      return await ctx.db
        .query("inspections")
        .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("inspections")
      .withIndex("by_inspector_status", (q) =>
        q.eq("inspectorId", user._id).eq("status", "COMPLETED")
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get a single inspection with its room inspections.
 */
export const getById = query({
  args: { inspectionId: v.id("inspections") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const inspection = await ctx.db.get(args.inspectionId);
    if (!inspection) return null;

    const roomInspections = await ctx.db
      .query("roomInspections")
      .withIndex("by_inspection", (q) =>
        q.eq("inspectionId", args.inspectionId)
      )
      .collect();

    // Get task result counts for each room
    const roomsWithProgress = await Promise.all(
      roomInspections.map(async (ri) => {
        const taskResults = await ctx.db
          .query("taskResults")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", ri._id)
          )
          .collect();

        const photos = await ctx.db
          .query("photos")
          .withIndex("by_room_inspection", (q) =>
            q.eq("roomInspectionId", ri._id)
          )
          .collect();

        const completedTasks = taskResults.filter((t) => t.completed).length;

        return {
          ...ri,
          totalTasks: taskResults.length,
          completedTasks,
          photoCount: photos.length,
        };
      })
    );

    return { ...inspection, roomInspections: roomsWithProgress };
  },
});

/**
 * Start a new inspection for a property.
 * Creates room inspections + task results from templates.
 */
export const create = mutation({
  args: {
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    // Create the inspection
    const inspectionId = await ctx.db.insert("inspections", {
      propertyId: args.propertyId,
      propertyName: property.name,
      inspectorId: user._id,
      inspectorName: user.name,
      status: "IN_PROGRESS",
    });

    // Get all room templates with tasks
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_sort_order")
      .collect();

    for (const room of rooms) {
      const roomInspectionId = await ctx.db.insert("roomInspections", {
        inspectionId,
        roomId: room._id,
        roomName: room.name,
        status: "PENDING",
      });

      // Create task results from task templates
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();

      for (const task of tasks) {
        await ctx.db.insert("taskResults", {
          taskId: task._id,
          roomInspectionId,
          taskDescription: task.description,
          completed: false,
        });
      }
    }

    return inspectionId;
  },
});

/**
 * Complete an inspection.
 */
export const complete = mutation({
  args: {
    inspectionId: v.id("inspections"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    await ctx.db.patch(args.inspectionId, {
      status: "COMPLETED",
      completedAt: Date.now(),
      notes: args.notes,
    });
  },
});
