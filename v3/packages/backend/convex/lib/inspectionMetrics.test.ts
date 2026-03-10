import { describe, expect, it } from "vitest";
import {
  applyRoomInspectionMetricDelta,
  shouldReopenCompletedRoomInspection,
} from "./inspectionMetrics";

describe("applyRoomInspectionMetricDelta", () => {
  it("updates issue, task, and photo counters without dropping below zero", () => {
    expect(
      applyRoomInspectionMetricDelta(
        {
          totalTasks: 5,
          completedTasks: 4,
          issueCount: 1,
          photoCount: 2,
        },
        {
          completedTasks: -1,
          issueCount: 2,
          photoCount: -5,
        }
      )
    ).toEqual({
      totalTasks: 5,
      completedTasks: 3,
      issueCount: 3,
      photoCount: 0,
    });
  });
});

describe("shouldReopenCompletedRoomInspection", () => {
  it("reopens when task completion or photo minimum no longer holds", () => {
    expect(
      shouldReopenCompletedRoomInspection({
        totalTasks: 4,
        completedTasks: 3,
        photoCount: 2,
        requiredPhotoMin: 2,
      })
    ).toBe(true);

    expect(
      shouldReopenCompletedRoomInspection({
        totalTasks: 4,
        completedTasks: 4,
        photoCount: 1,
        requiredPhotoMin: 2,
      })
    ).toBe(true);
  });

  it("stays completed when both task and photo requirements still hold", () => {
    expect(
      shouldReopenCompletedRoomInspection({
        totalTasks: 4,
        completedTasks: 4,
        photoCount: 2,
        requiredPhotoMin: 2,
      })
    ).toBe(false);
  });
});
