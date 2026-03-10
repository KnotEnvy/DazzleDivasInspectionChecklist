import { describe, expect, it } from "vitest";
import type { OutboxItem } from "@/lib/offlineOutbox";
import {
  getDiscardedDependentOutboxItemCount,
  getDiscardedOutboxItemIds,
} from "@/lib/offlineOutbox";

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
    attempts: 0,
    status: "CONFLICT",
    ...overrides,
  } as OutboxItem;
}

describe("getDiscardedOutboxItemIds", () => {
  it("cascades discard through dependent room and checklist completion items", () => {
    const ids = getDiscardedOutboxItemIds(
      [
        makeOutboxItem({
          id: "task-conflict",
          type: "SET_TASK_COMPLETED",
        }),
        makeOutboxItem({
          id: "room-complete",
          type: "COMPLETE_ROOM",
          status: "QUEUED",
          payload: {
            inspectionId: "inspection-1",
            roomInspectionId: "room-1",
          },
        }),
        makeOutboxItem({
          id: "inspection-complete",
          type: "COMPLETE_INSPECTION",
          status: "FAILED",
          payload: {
            inspectionId: "inspection-1",
          },
        }),
      ],
      "task-conflict"
    );

    expect(ids).toEqual(
      expect.arrayContaining(["task-conflict", "room-complete", "inspection-complete"])
    );
  });

  it("cascades room completion discard into checklist completion only", () => {
    const ids = getDiscardedOutboxItemIds(
      [
        makeOutboxItem({
          id: "room-conflict",
          type: "COMPLETE_ROOM",
          payload: {
            inspectionId: "inspection-1",
            roomInspectionId: "room-1",
          },
        }),
        makeOutboxItem({
          id: "inspection-complete",
          type: "COMPLETE_INSPECTION",
          status: "CONFLICT",
          payload: {
            inspectionId: "inspection-1",
          },
        }),
        makeOutboxItem({
          id: "other-room-complete",
          type: "COMPLETE_ROOM",
          status: "QUEUED",
          payload: {
            inspectionId: "inspection-1",
            roomInspectionId: "room-2",
          },
        }),
      ],
      "room-conflict"
    );

    expect(ids).toEqual(expect.arrayContaining(["room-conflict", "inspection-complete"]));
    expect(ids).not.toContain("other-room-complete");
  });

  it("leaves unrelated evidence conflicts isolated", () => {
    const ids = getDiscardedOutboxItemIds(
      [
        makeOutboxItem({
          id: "notes-conflict",
          type: "UPDATE_ROOM_NOTES",
          payload: {
            inspectionId: "inspection-1",
            roomInspectionId: "room-1",
            notes: "Needs follow-up",
          },
        }),
        makeOutboxItem({
          id: "inspection-complete",
          type: "COMPLETE_INSPECTION",
          status: "QUEUED",
          payload: {
            inspectionId: "inspection-1",
          },
        }),
      ],
      "notes-conflict"
    );

    expect(ids).toEqual(["notes-conflict"]);
    expect(getDiscardedDependentOutboxItemCount(
      [
        makeOutboxItem({
          id: "notes-conflict",
          type: "UPDATE_ROOM_NOTES",
          payload: {
            inspectionId: "inspection-1",
            roomInspectionId: "room-1",
            notes: "Needs follow-up",
          },
        }),
        makeOutboxItem({
          id: "inspection-complete",
          type: "COMPLETE_INSPECTION",
          status: "QUEUED",
          payload: {
            inspectionId: "inspection-1",
          },
        }),
      ],
      "notes-conflict"
    )).toBe(0);
  });
});
