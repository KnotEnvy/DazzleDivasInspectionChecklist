import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;

export type RoomInspectionMetrics = {
  totalTasks: number;
  completedTasks: number;
  issueCount: number;
  photoCount: number;
};

export function applyRoomInspectionMetricDelta(
  current: RoomInspectionMetrics,
  deltas: Partial<RoomInspectionMetrics>
): RoomInspectionMetrics {
  return {
    totalTasks: clampMetric(current.totalTasks + (deltas.totalTasks ?? 0)),
    completedTasks: clampMetric(current.completedTasks + (deltas.completedTasks ?? 0)),
    issueCount: clampMetric(current.issueCount + (deltas.issueCount ?? 0)),
    photoCount: clampMetric(current.photoCount + (deltas.photoCount ?? 0)),
  };
}

export function shouldReopenCompletedRoomInspection(params: {
  totalTasks: number;
  completedTasks: number;
  photoCount: number;
  requiredPhotoMin: number;
}) {
  return (
    params.completedTasks < params.totalTasks || params.photoCount < params.requiredPhotoMin
  );
}

function hasStoredRoomInspectionMetrics(roomInspection: Doc<"roomInspections">) {
  return (
    typeof roomInspection.totalTasks === "number" &&
    typeof roomInspection.completedTasks === "number" &&
    typeof roomInspection.issueCount === "number" &&
    typeof roomInspection.photoCount === "number"
  );
}

function clampMetric(value: number) {
  return Math.max(0, value);
}

export async function computeRoomInspectionMetrics(
  ctx: Ctx,
  roomInspectionId: Id<"roomInspections">
): Promise<RoomInspectionMetrics> {
  const [taskResults, photos] = await Promise.all([
    ctx.db
      .query("taskResults")
      .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspectionId))
      .collect(),
    ctx.db
      .query("photos")
      .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspectionId))
      .collect(),
  ]);

  return {
    totalTasks: taskResults.length,
    completedTasks: taskResults.filter((task) => task.completed).length,
    issueCount: taskResults.filter((task) => task.hasIssue).length,
    photoCount: photos.length,
  };
}

export async function getRoomInspectionMetrics(
  ctx: Ctx,
  roomInspection: Doc<"roomInspections">
): Promise<RoomInspectionMetrics> {
  if (hasStoredRoomInspectionMetrics(roomInspection)) {
    const {
      totalTasks = 0,
      completedTasks = 0,
      issueCount = 0,
      photoCount = 0,
    } = roomInspection;

    return {
      totalTasks,
      completedTasks,
      issueCount,
      photoCount,
    };
  }

  return await computeRoomInspectionMetrics(ctx, roomInspection._id);
}

export async function adjustRoomInspectionMetrics(
  ctx: MutationCtx,
  roomInspectionId: Id<"roomInspections">,
  _deltas: Partial<RoomInspectionMetrics>
) {
  const roomInspection = await ctx.db.get(roomInspectionId);
  if (!roomInspection) {
    throw new Error("Room inspection not found");
  }

  const next = await computeRoomInspectionMetrics(ctx, roomInspectionId);

  await ctx.db.patch(roomInspectionId, next);

  return {
    roomInspection,
    metrics: next,
  };
}

export async function loadInspectionIssueCount(
  ctx: Ctx,
  inspectionId: Id<"inspections">
) {
  const roomInspections = await ctx.db
    .query("roomInspections")
    .withIndex("by_inspection", (q) => q.eq("inspectionId", inspectionId))
    .collect();

  let total = 0;
  for (const roomInspection of roomInspections) {
    const metrics = await getRoomInspectionMetrics(ctx, roomInspection);
    total += metrics.issueCount;
  }

  return total;
}

export async function adjustInspectionIssueCount(
  ctx: MutationCtx,
  inspectionId: Id<"inspections">,
  delta: number
) {
  const inspection = await ctx.db.get(inspectionId);
  if (!inspection) {
    throw new Error("Inspection not found");
  }

  const current =
    typeof inspection.issueCount === "number"
      ? inspection.issueCount
      : await loadInspectionIssueCount(ctx, inspectionId);

  const next = clampMetric(current + delta);
  await ctx.db.patch(inspectionId, {
    issueCount: next,
  });
  return next;
}

export async function reopenRoomInspectionIfInvalid(
  ctx: MutationCtx,
  roomInspectionOrId: Doc<"roomInspections"> | Id<"roomInspections">,
  metrics?: RoomInspectionMetrics
) {
  const roomInspection =
    typeof roomInspectionOrId === "string"
      ? await ctx.db.get(roomInspectionOrId)
      : roomInspectionOrId;

  if (!roomInspection || roomInspection.status !== "COMPLETED") {
    return;
  }

  const currentMetrics = metrics ?? (await getRoomInspectionMetrics(ctx, roomInspection));

  if (
    shouldReopenCompletedRoomInspection({
      ...currentMetrics,
      requiredPhotoMin: roomInspection.requiredPhotoMin,
    })
  ) {
    await ctx.db.patch(roomInspection._id, {
      status: "PENDING",
      completedAt: undefined,
    });
  }
}

export async function loadInspectionTaskResults(
  ctx: Ctx,
  inspectionId: Id<"inspections">,
  roomInspections: Array<Doc<"roomInspections">>
) {
  const taskResults = await ctx.db
    .query("taskResults")
    .withIndex("by_inspection", (q) => q.eq("inspectionId", inspectionId))
    .collect();

  if (taskResults.length > 0 || roomInspections.length === 0) {
    return taskResults;
  }

  const taskResultGroups = await Promise.all(
    roomInspections.map((roomInspection) =>
      ctx.db
        .query("taskResults")
        .withIndex("by_room_inspection", (q) => q.eq("roomInspectionId", roomInspection._id))
        .collect()
    )
  );

  return taskResultGroups.flat();
}
