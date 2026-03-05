import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assignmentRoleForChecklistType } from "./validators";

type Ctx = QueryCtx | MutationCtx;

export async function requireAuth(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return user;
}

export async function assertPropertyAccessForChecklist(
  ctx: Ctx,
  user: Doc<"users">,
  propertyId: Id<"properties">,
  checklistType: "CLEANING" | "INSPECTION"
): Promise<void> {
  if (user.role === "ADMIN") {
    return;
  }

  const requiredRole = assignmentRoleForChecklistType(checklistType);

  if (user.role !== requiredRole) {
    throw new Error(`${requiredRole} role is required for this checklist type`);
  }

  const assignment = await ctx.db
    .query("propertyAssignments")
    .withIndex("by_property_user_role_active", (q) =>
      q
        .eq("propertyId", propertyId)
        .eq("userId", user._id)
        .eq("assignmentRole", requiredRole)
        .eq("isActive", true)
    )
    .unique();

  if (!assignment) {
    throw new Error("User is not assigned to this property for this checklist type");
  }
}

export async function getInspectionOrThrow(
  ctx: Ctx,
  inspectionId: Id<"inspections">
): Promise<Doc<"inspections">> {
  const inspection = await ctx.db.get(inspectionId);
  if (!inspection) {
    throw new Error("Inspection not found");
  }
  return inspection;
}

export async function requireInspectionAccess(
  ctx: Ctx,
  inspectionId: Id<"inspections">
): Promise<{ user: Doc<"users">; inspection: Doc<"inspections"> }> {
  const user = await requireAuth(ctx);
  const inspection = await getInspectionOrThrow(ctx, inspectionId);

  if (user.role === "ADMIN" || inspection.assigneeId === user._id) {
    return { user, inspection };
  }

  throw new Error("You do not have access to this inspection");
}

export async function requireRoomInspectionAccess(
  ctx: Ctx,
  roomInspectionId: Id<"roomInspections">
): Promise<{
  user: Doc<"users">;
  inspection: Doc<"inspections">;
  roomInspection: Doc<"roomInspections">;
}> {
  const roomInspection = await ctx.db.get(roomInspectionId);
  if (!roomInspection) {
    throw new Error("Room inspection not found");
  }

  const { user, inspection } = await requireInspectionAccess(
    ctx,
    roomInspection.inspectionId
  );

  return { user, inspection, roomInspection };
}

export async function requireTaskResultAccess(
  ctx: Ctx,
  taskResultId: Id<"taskResults">
): Promise<{
  user: Doc<"users">;
  inspection: Doc<"inspections">;
  roomInspection: Doc<"roomInspections">;
  taskResult: Doc<"taskResults">;
}> {
  const taskResult = await ctx.db.get(taskResultId);
  if (!taskResult) {
    throw new Error("Task result not found");
  }

  const { user, inspection, roomInspection } = await requireRoomInspectionAccess(
    ctx,
    taskResult.roomInspectionId
  );

  return { user, inspection, roomInspection, taskResult };
}

