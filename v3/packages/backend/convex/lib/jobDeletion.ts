import type { Doc } from "../_generated/dataModel";

export function getJobDeleteBlockReason(
  job: Pick<Doc<"jobs">, "status" | "linkedInspectionId">
) {
  if (job.linkedInspectionId) {
    return "Jobs with linked checklists cannot be deleted";
  }

  if (job.status === "IN_PROGRESS") {
    return "In-progress jobs cannot be deleted";
  }

  if (job.status === "COMPLETED") {
    return "Completed jobs cannot be deleted";
  }

  return null;
}

export function canDeleteJob(job: Pick<Doc<"jobs">, "status" | "linkedInspectionId">) {
  return getJobDeleteBlockReason(job) === null;
}
