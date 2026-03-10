import { describe, expect, it } from "vitest";
import {
  buildCompletedInspectionHistoryItem,
  buildInspectionReport,
} from "./inspectionReporting";

describe("buildCompletedInspectionHistoryItem", () => {
  it("preserves completed inspection data and injects the issue count used by history", () => {
    const result = buildCompletedInspectionHistoryItem(
      {
        _id: "inspection-1",
        _creationTime: Date.UTC(2026, 2, 1),
        completedAt: Date.UTC(2026, 2, 2),
        propertyName: "Palm House",
        type: "INSPECTION",
        status: "COMPLETED",
      },
      2
    );

    expect(result.propertyName).toBe("Palm House");
    expect(result.issueCount).toBe(2);
  });
});

describe("buildInspectionReport", () => {
  it("includes room photo counts plus task-level issue flags and notes", () => {
    const report = buildInspectionReport({
      inspection: {
        _id: "inspection-1",
        _creationTime: Date.UTC(2026, 2, 1),
        completedAt: Date.UTC(2026, 2, 2),
        propertyName: "Palm House",
        assigneeName: "Jordan",
        type: "CLEANING",
        status: "COMPLETED",
        notes: "Final walkthrough complete",
      },
      property: {
        address: "123 Ocean Ave",
      },
      roomInspections: [
        {
          _id: "room-1",
          roomName: "Kitchen",
          status: "COMPLETED",
          notes: "Counter stain needs follow-up",
          requiredPhotoMin: 2,
        },
      ],
      taskResults: [
        {
          roomInspectionId: "room-1",
          taskDescription: "Wipe counters",
          completed: true,
          hasIssue: true,
          issueNotes: "Stain would not lift",
        },
        {
          roomInspectionId: "room-1",
          taskDescription: "Sweep floor",
          completed: true,
        },
      ],
      photoCountByRoomInspectionId: new Map([["room-1", 3]]),
    });

    expect(report.property_address).toBe("123 Ocean Ave");
    expect(report.rooms).toHaveLength(1);
    expect(report.rooms[0]?.photo_count).toBe(3);
    expect(report.rooms[0]?.tasks[0]).toEqual({
      description: "Wipe counters",
      completed: true,
      has_issue: true,
      issue_notes: "Stain would not lift",
    });
    expect(report.rooms[0]?.tasks[1]?.has_issue).toBe(false);
    expect(report.notes).toBe("Final walkthrough complete");
  });

  it("falls back to creation time when completedAt is not set", () => {
    const createdAt = Date.UTC(2026, 2, 5);
    const report = buildInspectionReport({
      inspection: {
        _id: "inspection-2",
        _creationTime: createdAt,
        propertyName: "Garden House",
        type: "INSPECTION",
        status: "IN_PROGRESS",
      },
      property: null,
      roomInspections: [],
      taskResults: [],
      photoCountByRoomInspectionId: new Map(),
    });

    expect(report.inspection_date).toBe(new Date(createdAt).toISOString());
  });
});
