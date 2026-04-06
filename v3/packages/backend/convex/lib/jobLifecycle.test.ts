import { describe, expect, it } from "vitest";
import {
  assertAllRoomsCompleted,
  getJobChecklistStartTiming,
  getMaxActiveChecklistsForRole,
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
        scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
        linkedInspectionId: "inspection-1",
        assigneeId: "worker-1",
      },
      propertyId: "property-1",
      checklistType: "CLEANING",
      actor,
      existingInspectionExists: true,
      currentTime: Date.UTC(2026, 3, 5, 12, 0, 0),
      propertyTimeZone: "UTC",
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
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
          assigneeId: "worker-1",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 12, 0, 0),
        propertyTimeZone: "UTC",
      })
    ).toThrow("Job does not belong to the selected property");

    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "INSPECTION",
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
          assigneeId: "worker-2",
        },
        propertyId: "property-1",
        checklistType: "INSPECTION",
        actor: {
          _id: "worker-1",
          role: "INSPECTOR",
        },
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 12, 0, 0),
        propertyTimeZone: "UTC",
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
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor: {
          _id: "admin-1",
          role: "ADMIN",
        },
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 12, 0, 0),
        propertyTimeZone: "UTC",
      })
    ).toThrow("This job type does not support checklist execution");

    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "INSPECTION",
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor: {
          _id: "admin-1",
          role: "ADMIN",
        },
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 12, 0, 0),
        propertyTimeZone: "UTC",
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
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 12, 0, 0),
        propertyTimeZone: "UTC",
      })
    ).toThrow("This job cannot start a checklist");
  });

  it("blocks future jobs and same-day starts before 7am", () => {
    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "CLEANING",
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
          assigneeId: "worker-1",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 5, 12, 0, 0),
        propertyTimeZone: "UTC",
      })
    ).toThrow("This checklist can start on Apr 6, 7:00 AM.");

    expect(() =>
      validateChecklistStartFromJob({
        jobIdProvided: true,
        job: {
          propertyId: "property-1",
          status: "SCHEDULED",
          jobType: "CLEANING",
          scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
          assigneeId: "worker-1",
        },
        propertyId: "property-1",
        checklistType: "CLEANING",
        actor,
        existingInspectionExists: false,
        currentTime: Date.UTC(2026, 3, 6, 6, 30, 0),
        propertyTimeZone: "UTC",
      })
    ).toThrow("Checklists can start at Apr 6, 7:00 AM or later.");
  });
});

describe("getJobChecklistStartTiming", () => {
  it("allows same-day starts at 7am and overdue starts after 7am", () => {
    expect(
      getJobChecklistStartTiming({
        scheduledStart: Date.UTC(2026, 3, 6, 15, 0, 0),
        currentTime: Date.UTC(2026, 3, 6, 7, 0, 0),
        timeZone: "UTC",
      }).canStart
    ).toBe(true);

    expect(
      getJobChecklistStartTiming({
        scheduledStart: Date.UTC(2026, 3, 5, 15, 0, 0),
        currentTime: Date.UTC(2026, 3, 6, 8, 0, 0),
        timeZone: "UTC",
      }).canStart
    ).toBe(true);

    expect(
      getJobChecklistStartTiming({
        scheduledStart: Date.UTC(2026, 3, 5, 15, 0, 0),
        currentTime: Date.UTC(2026, 3, 6, 6, 0, 0),
        timeZone: "UTC",
      }).canStart
    ).toBe(false);
  });
});

describe("getMaxActiveChecklistsForRole", () => {
  it("uses role-based checklist limits", () => {
    expect(getMaxActiveChecklistsForRole("CLEANER")).toBe(3);
    expect(getMaxActiveChecklistsForRole("INSPECTOR")).toBe(5);
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
    ).toThrow("Complete the remaining 1 room before finishing the checklist");
  });
});
