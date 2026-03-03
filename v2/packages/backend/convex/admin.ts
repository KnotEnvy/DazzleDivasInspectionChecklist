import { query } from "./_generated/server";
import { requireAdmin } from "./lib/permissions";

/**
 * Get dashboard statistics for admin view.
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const properties = await ctx.db
      .query("properties")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const inspectors = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "INSPECTOR"))
      .collect()
      .then((users) => users.filter((u) => u.isActive));

    const activeInspections = await ctx.db
      .query("inspections")
      .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
      .collect();

    const completedInspections = await ctx.db
      .query("inspections")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
      .collect();

    const recentInspections = await ctx.db
      .query("inspections")
      .order("desc")
      .take(10);

    return {
      totalProperties: properties.length,
      totalInspectors: inspectors.length,
      activeInspections: activeInspections.length,
      completedInspections: completedInspections.length,
      recentInspections,
    };
  },
});
