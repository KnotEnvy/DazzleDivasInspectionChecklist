import { query } from "./_generated/server";
import { requireAdmin } from "./lib/permissions";

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, activeProperties, activeInspections, completedInspections] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db
          .query("properties")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect(),
        ctx.db
          .query("inspections")
          .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
          .collect(),
        ctx.db
          .query("inspections")
          .withIndex("by_status", (q) => q.eq("status", "COMPLETED"))
          .collect(),
      ]);

    return {
      users: users.length,
      activeProperties: activeProperties.length,
      activeInspections: activeInspections.length,
      completedInspections: completedInspections.length,
    };
  },
});

