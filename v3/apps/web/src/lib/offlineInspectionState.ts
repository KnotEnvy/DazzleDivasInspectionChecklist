import {
  isOutboxActionable,
  type OutboxItem,
  type PhotoKind,
} from "@/lib/offlineOutbox";

type RoomSummaryLike = {
  _id: string;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
  completedTasks: number;
  totalTasks: number;
  issueCount?: number;
  photoCount: number;
};

type InspectionLike = {
  _id: string;
  status: "IN_PROGRESS" | "COMPLETED";
  notes?: string;
  roomInspections: RoomSummaryLike[];
};

type RoomDetailTaskLike = {
  _id: string;
  taskDescription: string;
  completed: boolean;
  hasIssue?: boolean;
  issueNotes?: string;
};

type RoomDetailPhotoLike = {
  _id: string;
  fileName: string;
  mimeType: string;
  kind?: PhotoKind;
  url: string | null;
};

type RoomDetailLike = {
  _id: string;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
  taskResults: RoomDetailTaskLike[];
  photos: RoomDetailPhotoLike[];
};

export type PendingDisplayPhoto = {
  _id: string;
  fileName: string;
  mimeType: string;
  kind?: PhotoKind;
  url: string | null;
  isPendingUpload?: boolean;
  hasConflict?: boolean;
  blob?: Blob;
};

export type InspectionOutboxDiagnostics = {
  relevantPendingCount: number;
  relevantConflictCount: number;
};

export function applyInspectionOutboxOverlay<
  TInspection extends InspectionLike,
  TRoom extends RoomDetailLike
>(
  inspection: TInspection | null | undefined,
  selectedRoom: TRoom | null | undefined,
  items: OutboxItem[]
): {
  inspection: TInspection | null | undefined;
  selectedRoom:
    | (Omit<TRoom, "photos"> & {
        photos: PendingDisplayPhoto[];
      })
    | null
    | undefined;
  diagnostics: InspectionOutboxDiagnostics;
} {
  if (!inspection) {
    return {
      inspection,
      selectedRoom,
      diagnostics: {
        relevantPendingCount: 0,
        relevantConflictCount: 0,
      },
    };
  }

  const relevantItems = items.filter((item) => {
    if (item.type === "UPDATE_MY_JOB_STATUS") {
      return false;
    }

    if (item.type === "CREATE_INSPECTION") {
      return false;
    }

    const payloadInspectionId =
      "inspectionId" in item.payload ? item.payload.inspectionId : undefined;
    return payloadInspectionId === inspection._id;
  });

  const actionable = relevantItems
    .filter(isOutboxActionable)
    .sort((left, right) => left.createdAt - right.createdAt);

  const roomTaskDeltas = new Map<string, number>();
  const roomIssueDeltas = new Map<string, number>();
  const roomNotes = new Map<string, string>();
  const roomCompletions = new Set<string>();
  const removedPhotoIds = new Set<string>();
  const uploadedPhotosByRoom = new Map<string, PendingDisplayPhoto[]>();
  const conflictedPhotosByRoom = new Map<string, PendingDisplayPhoto[]>();
  let inspectionNotes = inspection.notes;
  let inspectionStatus = inspection.status;

  for (const item of actionable) {
    switch (item.type) {
      case "SET_TASK_COMPLETED": {
        if (item.payload.previousCompleted !== undefined) {
          const delta =
            item.payload.completed === item.payload.previousCompleted
              ? 0
              : item.payload.completed
                ? 1
                : -1;
          if (delta !== 0) {
            roomTaskDeltas.set(
              item.payload.roomInspectionId,
              (roomTaskDeltas.get(item.payload.roomInspectionId) ?? 0) + delta
            );
          }
        }
        break;
      }

      case "SET_TASK_ISSUE": {
        if (item.payload.previousHasIssue !== undefined) {
          const delta =
            item.payload.hasIssue === item.payload.previousHasIssue
              ? 0
              : item.payload.hasIssue
                ? 1
                : -1;
          if (delta !== 0) {
            roomIssueDeltas.set(
              item.payload.roomInspectionId,
              (roomIssueDeltas.get(item.payload.roomInspectionId) ?? 0) + delta
            );
          }
        }
        break;
      }

      case "UPDATE_ROOM_NOTES":
        roomNotes.set(item.payload.roomInspectionId, item.payload.notes);
        break;

      case "UPLOAD_PHOTO": {
        const pendingPhotos = uploadedPhotosByRoom.get(item.payload.roomInspectionId) ?? [];
        pendingPhotos.push({
          _id: item.payload.localPhotoId,
          fileName: item.payload.fileName,
          mimeType: item.payload.mimeType,
          kind: item.payload.kind,
          url: null,
          isPendingUpload: true,
          blob: item.payload.file,
        });
        uploadedPhotosByRoom.set(item.payload.roomInspectionId, pendingPhotos);
        break;
      }

      case "REMOVE_PHOTO":
        removedPhotoIds.add(item.payload.photoId);
        break;

      case "COMPLETE_ROOM":
        roomCompletions.add(item.payload.roomInspectionId);
        break;

      case "COMPLETE_INSPECTION":
        inspectionStatus = "COMPLETED";
        inspectionNotes = item.payload.notes ?? inspectionNotes;
        break;
    }
  }

  for (const item of relevantItems) {
    if (item.status !== "CONFLICT" || item.type !== "UPLOAD_PHOTO") {
      continue;
    }

    const conflictedPhotos = conflictedPhotosByRoom.get(item.payload.roomInspectionId) ?? [];
    conflictedPhotos.push({
      _id: item.payload.localPhotoId,
      fileName: item.payload.fileName,
      mimeType: item.payload.mimeType,
      kind: item.payload.kind,
      url: null,
      isPendingUpload: true,
      hasConflict: true,
      blob: item.payload.file,
    });
    conflictedPhotosByRoom.set(item.payload.roomInspectionId, conflictedPhotos);
  }

  const nextInspection = {
    ...inspection,
    status: inspectionStatus,
    notes: inspectionNotes,
    roomInspections: inspection.roomInspections.map((room) => {
      const photoUploads = uploadedPhotosByRoom.get(room._id)?.length ?? 0;
      const photoRemovals = selectedRoom?._id === room._id
        ? selectedRoom.photos.filter((photo) => removedPhotoIds.has(photo._id)).length
        : 0;

      return {
        ...room,
        status: roomCompletions.has(room._id) ? "COMPLETED" : room.status,
        notes: roomNotes.get(room._id) ?? room.notes,
        completedTasks: Math.max(
          0,
          Math.min(room.totalTasks, room.completedTasks + (roomTaskDeltas.get(room._id) ?? 0))
        ),
        issueCount: Math.max(0, (room.issueCount ?? 0) + (roomIssueDeltas.get(room._id) ?? 0)),
        photoCount: Math.max(0, room.photoCount + photoUploads - photoRemovals),
      };
    }),
  } as TInspection;

  if (!selectedRoom) {
    return {
      inspection: nextInspection,
      selectedRoom,
      diagnostics: {
        relevantPendingCount: actionable.length,
        relevantConflictCount: relevantItems.filter((item) => item.status === "CONFLICT").length,
      },
    };
  }

  const taskOverrides = new Map<string, boolean>();
  const taskIssueOverrides = new Map<string, { hasIssue: boolean; issueNotes?: string }>();
  for (const item of actionable) {
    if (item.type === "SET_TASK_COMPLETED") {
      taskOverrides.set(item.payload.taskResultId, item.payload.completed);
    }

    if (item.type === "SET_TASK_ISSUE") {
      taskIssueOverrides.set(item.payload.taskResultId, {
        hasIssue: item.payload.hasIssue,
        issueNotes: item.payload.issueNotes,
      });
    }
  }

  const uploadedPhotos = uploadedPhotosByRoom.get(selectedRoom._id) ?? [];
  const conflictedPhotos = conflictedPhotosByRoom.get(selectedRoom._id) ?? [];
  const nextSelectedRoom = {
    ...selectedRoom,
    status: roomCompletions.has(selectedRoom._id) ? "COMPLETED" : selectedRoom.status,
    notes: roomNotes.get(selectedRoom._id) ?? selectedRoom.notes,
    taskResults: selectedRoom.taskResults.map((task) => ({
      ...task,
      completed: taskOverrides.get(task._id) ?? task.completed,
      hasIssue: taskIssueOverrides.get(task._id)?.hasIssue ?? task.hasIssue,
      issueNotes: taskIssueOverrides.get(task._id)?.issueNotes ?? task.issueNotes,
    })),
    photos: [
      ...selectedRoom.photos.filter((photo) => !removedPhotoIds.has(photo._id)).map((photo) => ({
        ...photo,
        isPendingUpload: false,
      })),
      ...uploadedPhotos,
      ...conflictedPhotos,
    ],
  };

  return {
    inspection: nextInspection,
    selectedRoom: nextSelectedRoom,
    diagnostics: {
      relevantPendingCount: actionable.length,
      relevantConflictCount: relevantItems.filter((item) => item.status === "CONFLICT").length,
    },
  };
}

export function buildJobStatusOverlay(items: OutboxItem[]) {
  const latestStatusByJobId = new Map<string, "IN_PROGRESS" | "BLOCKED">();
  const queuedChecklistByJobId = new Set<string>();
  let conflictCount = 0;

  for (const item of items) {
    if (item.status === "CONFLICT") {
      conflictCount += 1;
    }

    if (!isOutboxActionable(item)) {
      continue;
    }

    if (item.type === "UPDATE_MY_JOB_STATUS") {
      latestStatusByJobId.set(item.payload.jobId, item.payload.status);
    }

    if (item.type === "CREATE_INSPECTION" && item.payload.jobId) {
      queuedChecklistByJobId.add(item.payload.jobId);
    }
  }

  return {
    latestStatusByJobId,
    queuedChecklistByJobId,
    conflictCount,
  };
}
