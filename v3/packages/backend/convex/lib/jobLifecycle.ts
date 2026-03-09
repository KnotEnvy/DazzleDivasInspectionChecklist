import { checklistTypeForJobType } from "./validators";

export type LifecycleChecklistType = "CLEANING" | "INSPECTION";
export type LifecycleJobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
export type LifecycleJobStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "BLOCKED";
export type LifecycleActorRole = "ADMIN" | "CLEANER" | "INSPECTOR";

export type ChecklistStartJobLike<
  TPropertyId extends string = string,
  TInspectionId extends string = string,
  TUserId extends string = string,
> = {
  propertyId: TPropertyId;
  status: LifecycleJobStatus;
  jobType: LifecycleJobType;
  linkedInspectionId?: TInspectionId;
  assigneeId?: TUserId;
};

export type ChecklistStartActorLike<TUserId extends string = string> = {
  _id: TUserId;
  role: LifecycleActorRole;
};

export function validateChecklistStartFromJob<
  TPropertyId extends string,
  TInspectionId extends string,
  TUserId extends string,
>(params: {
  jobIdProvided: boolean;
  job: ChecklistStartJobLike<TPropertyId, TInspectionId, TUserId> | null;
  propertyId: TPropertyId;
  checklistType: LifecycleChecklistType;
  actor: ChecklistStartActorLike<TUserId>;
  existingInspectionExists: boolean;
}) {
  const { job } = params;

  if (params.jobIdProvided && !job) {
    throw new Error("Job not found");
  }

  if (!job) {
    return {
      existingInspectionId: undefined,
      skipPropertyAssignmentCheck: false,
      isAssignedWorkerForLinkedJob: false,
      nextAssigneeId: undefined,
    };
  }

  if (job.propertyId !== params.propertyId) {
    throw new Error("Job does not belong to the selected property");
  }

  if (job.status === "CANCELLED" || job.status === "COMPLETED") {
    throw new Error("This job cannot start a checklist");
  }

  const expectedType = checklistTypeForJobType(job.jobType);
  if (!expectedType) {
    throw new Error("This job type does not support checklist execution");
  }

  if (expectedType !== params.checklistType) {
    throw new Error("Checklist type does not match the selected job type");
  }

  if (job.linkedInspectionId && params.existingInspectionExists) {
    return {
      existingInspectionId: job.linkedInspectionId,
      skipPropertyAssignmentCheck: true,
      isAssignedWorkerForLinkedJob:
        params.actor.role !== "ADMIN" && job.assigneeId === params.actor._id,
      nextAssigneeId: job.assigneeId,
    };
  }

  if (
    params.actor.role !== "ADMIN" &&
    job.assigneeId &&
    job.assigneeId !== params.actor._id
  ) {
    throw new Error("You are not assigned to this job");
  }

  return {
    existingInspectionId: undefined,
    skipPropertyAssignmentCheck: true,
    isAssignedWorkerForLinkedJob:
      params.actor.role !== "ADMIN" && job.assigneeId === params.actor._id,
    nextAssigneeId: job.assigneeId,
  };
}

export function assertAllRoomsCompleted(
  rooms: Array<{ status: "PENDING" | "COMPLETED" }>
) {
  if (rooms.some((room) => room.status !== "COMPLETED")) {
    throw new Error("All room checklists must be completed first");
  }
}
