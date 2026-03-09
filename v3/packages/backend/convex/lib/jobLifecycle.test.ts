import { describe, expect, it } from "vitest";
import {
  assertAllRoomsCompleted,
  validateChecklistStartFromJob,
} from "./jobLifecycle";

describe("validateChecklistStartFromJob", () => {
  const actor = {
    _id: "worker-1",
    role: "CLEANER" as const,
  };

  it("rejects missing linked jobs when a job id was supplied", () => {
    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: null,
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
      })
    ).toThrow("Job not found");
  });

  it("reuses an existing linked inspection when present", () => {
    const result = validateChecklistStartFromJob({
      jobIdProvided: true,
      job: {
        propertyId: "property-1",
        status: "IN_PROGRESS",
        jobType: "CLEANING",
        linkedInspectionId: "inspection-1",
        assigneeId: "worker-1",
      },
      propertyId: "property-1",
      checklistType: "CLEANING",
      actor,
      existingInspectionExists: true,
    });

    expect(result.existingInspectionId).toBe("inspection-1");
    expect(result.skipPropertyAssignmentCheck).toBe(true);
    expect(result.isAssignedWorkerForLinkedJob).toBe(true);
  });

  it("blocks checklist starts for mismatched jobs and wrong assignees", () => {
    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-2",
          status: "SCHEDULED",
          jobType: "CLEANING",
          assigneeId: "worker-1",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
      })
    ).toThrow("Job does not belong to the selected property");

    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "INSPECTION",
          assigneeId: "worker-2",
        },
        propertyId: "property-1",
        checklistType: "INSPECTION",
        actor: {
          _id: "worker-1",
          role: "INSPECTOR",
        },
        existingInspectionExists: false,
      })
    ).toThrow("You are not assigned to this job");
  });

  it("blocks unsupported or mismatched checklist types", () => {
    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "MAINTENANCE",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor: {
          _id: "admin-1",
          role: "ADMIN",
        },
        existingInspectionExists: false,
      })
    ).toThrow("This job type does not support checklist execution");

    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "INSPECTION",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor: {
          _id: "admin-1",
          role: "ADMIN",
        },
        existingInspectionExists: false,
      })
    ).toThrow("Checklist type does not match the selected job type");
  });

  it("blocks cancelled or completed jobs from reopening the lifecycle", () => {
    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "CANCELLED",
          jobType: "CLEANING",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
      })
    ).toThrow("This job cannot start a checklist");
  });
});

describe("assertAllRoomsCompleted", () => {
  it("allows completion only when every room is completed", () => {
    expect(() =>
      assertAllRoomsCompleted([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
      ])
    ).not.toThrow();

    expect(() =>
      assertAllRoomsCompleted([
        { status: "COMPLETED" },
        { status: "PENDING" },
      ])
    ).toThrow("All room checklists must be completed first");
  });
});
