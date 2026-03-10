import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;

export type PropertySummaryMetrics = {
  activeCleanerAssignments: number;
  activeInspectorAssignments: number;
  activeServicePlans: number;
};

function hasStoredPropertySummaryMetrics(property: Doc<"properties">) {
  return (
    typeof property.activeCleanerAssignments === "number" &&
    typeof property.activeInspectorAssignments === "number" &&
    typeof property.activeServicePlans === "number"
  );
}

function clampMetric(value: number) {
  return Math.max(0, value);
}

export async function getPropertySummaryMetrics(
  ctx: Ctx,
  property: Doc<"properties">
): Promise<PropertySummaryMetrics> {
  if (hasStoredPropertySummaryMetrics(property)) {
    const {
      activeCleanerAssignments = 0,
      activeInspectorAssignments = 0,
      activeServicePlans = 0,
    } = property;

    return {
      activeCleanerAssignments,
      activeInspectorAssignments,
      activeServicePlans,
    };
  }

  const [assignments, plans] = await Promise.all([
    ctx.db
      .query("propertyAssignments")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect(),
    ctx.db
      .query("servicePlans")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .collect(),
  ]);

  return {
    activeCleanerAssignments: assignments.filter(
      (assignment) => assignment.isActive && assignment.assignmentRole === "CLEANER"
    ).length,
    activeInspectorAssignments: assignments.filter(
      (assignment) => assignment.isActive && assignment.assignmentRole === "INSPECTOR"
    ).length,
    activeServicePlans: plans.filter((plan) => plan.isActive).length,
  };
}

export async function adjustPropertySummaryMetrics(
  ctx: MutationCtx,
  propertyId: Id<"properties">,
  deltas: Partial<PropertySummaryMetrics>
) {
  const property = await ctx.db.get(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  const current = await getPropertySummaryMetrics(ctx, property);
  const next = {
    activeCleanerAssignments: clampMetric(
      current.activeCleanerAssignments + (deltas.activeCleanerAssignments ?? 0)
    ),
    activeInspectorAssignments: clampMetric(
      current.activeInspectorAssignments + (deltas.activeInspectorAssignments ?? 0)
    ),
    activeServicePlans: clampMetric(
      current.activeServicePlans + (deltas.activeServicePlans ?? 0)
    ),
  };

  await ctx.db.patch(propertyId, next);
  return next;
}
