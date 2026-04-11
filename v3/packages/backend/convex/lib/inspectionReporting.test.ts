import { describe, expect, it } from "vitest";
import {
  buildCompletedInspectionHistoryItem,
  buildCompletedInspectionReview,
  buildCompletedPhotoExportFileName,
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
    expect(result.financialApproved).toBe(false);
  });

  it("can mark a completed history row as financially approved", () => {
    const result = buildCompletedInspectionHistoryItem(
      {
        _id: "inspection-2",
        _creationTime: Date.UTC(2026, 2, 3),
        completedAt: Date.UTC(2026, 2, 4),
        propertyName: "Seabreeze",
        type: "CLEANING",
        status: "COMPLETED",
      },
      0,
      {
        financialApproved: true,
      }
    );

    expect(result.financialApproved).toBe(true);
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

describe("buildCompletedPhotoExportFileName", () => {
  it("builds a stable export file name for completed review downloads", () => {
    const exportFileName = buildCompletedPhotoExportFileName({
      propertyName: "Palm House #2",
      checklistType: "CLEANING",
      roomName: "Primary Bath",
      kind: "AFTER",
      fileName: "final-shot.JPG",
      mimeType: "image/jpeg",
      completedAt: Date.UTC(2026, 2, 2),
      createdAt: Date.UTC(2026, 2, 2, 10, 30),
      sequence: 3,
    });

    expect(exportFileName).toBe(
      "2026-03-02_Palm-House-2_CLEANING_Primary-Bath_AFTER_03.jpg"
    );
  });
});

describe("buildCompletedInspectionReview", () => {
  it("groups room evidence and emits export-ready photo metadata", () => {
    const review = buildCompletedInspectionReview({
      inspection: {
        _id: "inspection-3",
        _creationTime: Date.UTC(2026, 2, 1),
        completedAt: Date.UTC(2026, 2, 2, 17, 15),
        propertyName: "Palm House",
        assigneeName: "Jordan",
        type: "CLEANING",
        status: "COMPLETED",
        notes: "Ready for guest arrival",
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
          issueCount: 1,
        },
        {
          _id: "room-2",
          roomName: "Bedroom 1",
          status: "COMPLETED",
          requiredPhotoMin: 2,
        },
      ],
      taskResults: [
        {
          roomInspectionId: "room-1",
          taskDescription: "Sweep floor",
          completed: true,
          _creationTime: 2,
        },
        {
          roomInspectionId: "room-1",
          taskDescription: "Wipe counters",
          completed: true,
          hasIssue: true,
          issueNotes: "Stain would not lift",
          _creationTime: 1,
        },
        {
          roomInspectionId: "room-2",
          taskDescription: "Change linens",
          completed: true,
          _creationTime: 3,
        },
      ],
      photos: [
        {
          _id: "photo-1",
          roomInspectionId: "room-1",
          fileName: "kitchen-overview.png",
          fileSize: 100,
          mimeType: "image/png",
          kind: "AFTER",
          url: "https://example.com/photo-1",
          _creationTime: Date.UTC(2026, 2, 2, 15, 0),
        },
        {
          _id: "photo-2",
          roomInspectionId: "room-1",
          fileName: "kitchen-sink",
          fileSize: 101,
          mimeType: "image/jpeg",
          kind: "ISSUE",
          url: "https://example.com/photo-2",
          _creationTime: Date.UTC(2026, 2, 2, 15, 5),
        },
        {
          _id: "photo-3",
          roomInspectionId: "room-2",
          fileName: "bedroom.webp",
          fileSize: 102,
          mimeType: "image/webp",
          kind: "AFTER",
          url: "https://example.com/photo-3",
          _creationTime: Date.UTC(2026, 2, 2, 16, 0),
        },
      ],
    });

    expect(review.property_address).toBe("123 Ocean Ave");
    expect(review.issue_count).toBe(1);
    expect(review.photo_count).toBe(3);
    expect(review.rooms[0]?.tasks[0]?.description).toBe("Wipe counters");
    expect(review.rooms[0]?.photos[0]?.export_file_name).toBe(
      "2026-03-02_Palm-House_CLEANING_Kitchen_AFTER_01.png"
    );
    expect(review.rooms[0]?.photos[1]?.export_file_name).toBe(
      "2026-03-02_Palm-House_CLEANING_Kitchen_ISSUE_02.jpg"
    );
    expect(review.rooms[1]?.photo_count).toBe(1);
    expect(review.notes).toBe("Ready for guest arrival");
  });
});
