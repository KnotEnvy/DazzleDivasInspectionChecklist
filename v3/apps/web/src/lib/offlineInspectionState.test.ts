import { describe, expect, it } from "vitest";
import {
  applyInspectionOutboxOverlay,
  buildJobStatusOverlay,
} from "@/lib/offlineInspectionState";
import type { OutboxItem } from "@/lib/offlineOutbox";

function baseItem(overrides: Partial<OutboxItem>): OutboxItem {
  return {
    id: "item-1",
    type: "COMPLETE_ROOM",
    payload: {
      inspectionId: "inspection-1",
      roomInspectionId: "room-1",
    },
    createdAt: 1,
    updatedAt: 1,
    attempts: 0,
    status: "QUEUED",
    ...overrides,
  } as OutboxItem;
}

describe("applyInspectionOutboxOverlay", () => {
  it("applies queued field evidence and completion locally", () => {
    const inspection = {
      _id: "inspection-1",
      status: "IN_PROGRESS" as const,
      notes: "server notes",
      roomInspections: [
        {
          _id: "room-1",
          roomName: "Kitchen",
          status: "PENDING" as const,
          notes: "old room notes",
          requiredPhotoMin: 2,
          completedTasks: 1,
          totalTasks: 2,
          issueCount: 0,
          photoCount: 1,
        },
      ],
    };

    const room = {
      _id: "room-1",
      roomName: "Kitchen",
      status: "PENDING" as const,
      notes: "old room notes",
      requiredPhotoMin: 2,
      taskResults: [
        {
          _id: "task-1",
          taskDescription: "Task 1",
          completed: true,
          hasIssue: false,
          issueNotes: undefined,
        },
        {
          _id: "task-2",
          taskDescription: "Task 2",
          completed: false,
          hasIssue: false,
          issueNotes: undefined,
        },
      ],
      photos: [
        {
          _id: "photo-1",
          fileName: "before.jpg",
          mimeType: "image/jpeg",
          kind: "BEFORE" as const,
          url: "https://example.test/before.jpg",
        },
      ],
    };

    const items: OutboxItem[] = [
      baseItem({
        id: "task-update",
        type: "SET_TASK_COMPLETED",
        payload: {
          inspectionId: "inspection-1",
          roomInspectionId: "room-1",
          taskResultId: "task-2",
          completed: true,
          previousCompleted: false,
        },
      }),
      baseItem({
        id: "room-notes",
        type: "UPDATE_ROOM_NOTES",
        createdAt: 2,
        payload: {
          inspectionId: "inspection-1",
          roomInspectionId: "room-1",
          notes: "offline note",
        },
      }),
      baseItem({
        id: "task-issue",
        type: "SET_TASK_ISSUE",
        createdAt: 3,
        payload: {
          inspectionId: "inspection-1",
          roomInspectionId: "room-1",
          taskResultId: "task-2",
          hasIssue: true,
          issueNotes: "Broken supply bin",
          previousHasIssue: false,
        },
      }),
      baseItem({
        id: "photo-upload",
        type: "UPLOAD_PHOTO",
        createdAt: 4,
        payload: {
          inspectionId: "inspection-1",
          roomInspectionId: "room-1",
          localPhotoId: "local-photo-1",
          file: new Blob(["image"], { type: "image/jpeg" }),
          fileName: "after.jpg",
          fileSize: 5,
          mimeType: "image/jpeg",
          kind: "AFTER",
        },
      }),
      baseItem({
        id: "room-complete",
        type: "COMPLETE_ROOM",
        createdAt: 5,
      }),
      baseItem({
        id: "inspection-complete",
        type: "COMPLETE_INSPECTION",
        createdAt: 6,
        payload: {
          inspectionId: "inspection-1",
          notes: "offline inspection note",
        },
      }),
    ];

    const result = applyInspectionOutboxOverlay(inspection, room, items);

    expect(result.inspection?.status).toBe("COMPLETED");
    expect(result.inspection?.notes).toBe("offline inspection note");
    expect(result.inspection?.roomInspections[0]?.completedTasks).toBe(2);
    expect(result.inspection?.roomInspections[0]?.issueCount).toBe(1);
    expect(result.inspection?.roomInspections[0]?.photoCount).toBe(2);
    expect(result.inspection?.roomInspections[0]?.status).toBe("COMPLETED");

    expect(result.selectedRoom?.notes).toBe("offline note");
    expect(result.selectedRoom?.taskResults[1]?.completed).toBe(true);
    expect(result.selectedRoom?.taskResults[1]?.hasIssue).toBe(true);
    expect(result.selectedRoom?.taskResults[1]?.issueNotes).toBe("Broken supply bin");
    expect(result.selectedRoom?.photos).toHaveLength(2);
    expect(result.selectedRoom?.photos[1]?.isPendingUpload).toBe(true);
    expect(result.diagnostics.relevantPendingCount).toBe(6);
  });
});

describe("buildJobStatusOverlay", () => {
  it("tracks latest queued worker status, checklist starts, and conflicts", () => {
    const overlay = buildJobStatusOverlay([
      baseItem({
        id: "status-1",
        type: "UPDATE_MY_JOB_STATUS",
        payload: {
          jobId: "job-1",
          status: "IN_PROGRESS",
        },
      }),
      baseItem({
        id: "checklist-1",
        type: "CREATE_INSPECTION",
        createdAt: 2,
        payload: {
          propertyId: "property-1",
          type: "CLEANING",
          jobId: "job-1",
        },
      }),
      baseItem({
        id: "conflict-1",
        type: "UPDATE_MY_JOB_STATUS",
        createdAt: 3,
        status: "CONFLICT",
        payload: {
          jobId: "job-2",
          status: "BLOCKED",
        },
      }),
    ]);

    expect(overlay.latestStatusByJobId.get("job-1")).toBe("IN_PROGRESS");
    expect(overlay.queuedChecklistByJobId.has("job-1")).toBe(true);
    expect(overlay.conflictCount).toBe(1);
  });
});
