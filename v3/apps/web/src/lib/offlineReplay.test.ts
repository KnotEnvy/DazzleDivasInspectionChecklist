import { describe, expect, it } from "vitest";
import type { OutboxItem } from "@/lib/offlineOutbox";
import {
  classifyReplayFailureStatus,
  getOutboxReviewHref,
  getReplayConflictPolicy,
} from "@/lib/offlineReplay";

function makeOutboxItem(overrides: Partial<OutboxItem>): OutboxItem {
  return {
    id: "item-1",
    type: "SET_TASK_COMPLETED",
    payload: {
      inspectionId: "inspection-1",
      roomInspectionId: "room-1",
      taskResultId: "task-1",
      completed: true,
    },
    createdAt: 1,
    updatedAt: 1,
    attempts: 1,
    status: "CONFLICT",
    ...overrides,
  } as OutboxItem;
}

describe("classifyReplayFailureStatus", () => {
  it("treats connectivity failures as retryable", () => {
    expect(classifyReplayFailureStatus("Failed to fetch upload URL")).toBe("FAILED");
    expect(classifyReplayFailureStatus("Network timeout while replaying")).toBe("FAILED");
  });

  it("treats validation and permission failures as conflicts", () => {
    expect(classifyReplayFailureStatus("Only the assigned worker can update this job")).toBe(
      "CONFLICT"
    );
    expect(classifyReplayFailureStatus("Property not found or inactive")).toBe("CONFLICT");
  });
});

describe("getReplayConflictPolicy", () => {
  it("marks schedule state as server-owned and not retryable", () => {
    const policy = getReplayConflictPolicy(
      makeOutboxItem({
        type: "UPDATE_MY_JOB_STATUS",
        payload: {
          jobId: "job-1",
          status: "BLOCKED",
        },
      })
    );

    expect(policy.ownership).toBe("SERVER");
    expect(policy.canRetry).toBe(false);
  });

  it("marks checklist evidence as client-owned and retryable", () => {
    const policy = getReplayConflictPolicy(
      makeOutboxItem({
        type: "SET_TASK_ISSUE",
        payload: {
          inspectionId: "inspection-1",
          roomInspectionId: "room-1",
          taskResultId: "task-1",
          hasIssue: true,
          issueNotes: "Sink still dirty",
        },
      })
    );

    expect(policy.ownership).toBe("CLIENT");
    expect(policy.canRetry).toBe(true);
  });
});

describe("getOutboxReviewHref", () => {
  it("routes schedule conflicts back to My Schedule", () => {
    expect(
      getOutboxReviewHref(
        makeOutboxItem({
          type: "CREATE_INSPECTION",
          payload: {
            propertyId: "property-1",
            type: "CLEANING",
            jobId: "job-1",
          },
        })
      )
    ).toBe("/my-schedule");
  });

  it("routes checklist evidence conflicts back to the checklist", () => {
    expect(getOutboxReviewHref(makeOutboxItem({}))).toBe("/checklists/inspection-1");
  });
});
