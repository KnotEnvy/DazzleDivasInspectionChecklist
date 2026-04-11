type HistoryInspectionLike = {
  _id: string;
  _creationTime: number;
  completedAt?: number;
  propertyName: string;
  type: "CLEANING" | "INSPECTION";
  status: "IN_PROGRESS" | "COMPLETED";
  assigneeName?: string;
  notes?: string;
  financialApproved?: boolean;
};

type ReportInspectionLike = HistoryInspectionLike;

type ReportPropertyLike = {
  address?: string;
};

type ReportRoomLike = {
  _id: string;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
};

type ReportTaskLike = {
  roomInspectionId: string;
  taskDescription: string;
  completed: boolean;
  hasIssue?: boolean;
  issueNotes?: string;
  _creationTime?: number;
};

type ReviewPhotoLike = {
  _id: string;
  roomInspectionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  kind?: "BEFORE" | "AFTER" | "ISSUE" | "GENERAL";
  url: string | null;
  _creationTime: number;
};

type ReviewRoomLike = ReportRoomLike & {
  issueCount?: number;
};

const photoExtensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/gif": ".gif",
};

function sanitizeExportSegment(value: string) {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}

function getPhotoExtension(fileName: string, mimeType: string) {
  const extensionMatch = /\.[A-Za-z0-9]+$/.exec(fileName.trim());
  if (extensionMatch) {
    return extensionMatch[0].toLowerCase();
  }

  return photoExtensionByMimeType[mimeType.toLowerCase()] ?? ".jpg";
}

function buildTasksByRoomInspectionId(taskResults: ReportTaskLike[]) {
  const tasksByRoomInspectionId = new Map<string, ReportTaskLike[]>();

  for (const task of taskResults) {
    const existing = tasksByRoomInspectionId.get(task.roomInspectionId);
    if (existing) {
      existing.push(task);
    } else {
      tasksByRoomInspectionId.set(task.roomInspectionId, [task]);
    }
  }

  for (const tasks of tasksByRoomInspectionId.values()) {
    tasks.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0));
  }

  return tasksByRoomInspectionId;
}

export function buildCompletedPhotoExportFileName(params: {
  propertyName: string;
  checklistType: "CLEANING" | "INSPECTION";
  roomName: string;
  kind?: "BEFORE" | "AFTER" | "ISSUE" | "GENERAL";
  fileName: string;
  mimeType: string;
  completedAt?: number;
  createdAt: number;
  sequence: number;
}) {
  const exportDate = new Date(params.completedAt ?? params.createdAt)
    .toISOString()
    .slice(0, 10);
  const propertySegment = sanitizeExportSegment(params.propertyName);
  const typeSegment = sanitizeExportSegment(params.checklistType);
  const roomSegment = sanitizeExportSegment(params.roomName);
  const kindSegment = sanitizeExportSegment(params.kind ?? "GENERAL");
  const sequenceSegment = String(params.sequence).padStart(2, "0");
  const extension = getPhotoExtension(params.fileName, params.mimeType);

  return `${exportDate}_${propertySegment}_${typeSegment}_${roomSegment}_${kindSegment}_${sequenceSegment}${extension}`;
}

export function buildCompletedInspectionHistoryItem(
  inspection: HistoryInspectionLike,
  issueCount: number,
  options?: {
    financialApproved?: boolean;
  }
) {
  return {
    ...inspection,
    issueCount,
    financialApproved: options?.financialApproved === true,
  };
}

export function buildInspectionReport(params: {
  inspection: ReportInspectionLike;
  property: ReportPropertyLike | null;
  roomInspections: ReportRoomLike[];
  taskResults: ReportTaskLike[];
  photoCountByRoomInspectionId: Map<string, number>;
}) {
  const tasksByRoomInspectionId = buildTasksByRoomInspectionId(params.taskResults);

  return {
    property_name: params.inspection.propertyName,
    property_address: params.property?.address ?? "",
    checklist_type: params.inspection.type,
    assignee_name: params.inspection.assigneeName,
    inspection_date: params.inspection.completedAt
      ? new Date(params.inspection.completedAt).toISOString()
      : new Date(params.inspection._creationTime).toISOString(),
    status: params.inspection.status,
    notes: params.inspection.notes ?? null,
    rooms: params.roomInspections.map((roomInspection) => ({
      room_name: roomInspection.roomName,
      status: roomInspection.status,
      notes: roomInspection.notes ?? null,
      required_photo_min: roomInspection.requiredPhotoMin,
      photo_count: params.photoCountByRoomInspectionId.get(roomInspection._id) ?? 0,
      tasks: (tasksByRoomInspectionId.get(roomInspection._id) ?? []).map((task) => ({
        description: task.taskDescription,
        completed: task.completed,
        has_issue: task.hasIssue ?? false,
        issue_notes: task.issueNotes ?? null,
      })),
    })),
  };
}

export function buildCompletedInspectionReview(params: {
  inspection: ReportInspectionLike;
  property: ReportPropertyLike | null;
  roomInspections: ReviewRoomLike[];
  taskResults: ReportTaskLike[];
  photos: ReviewPhotoLike[];
}) {
  const tasksByRoomInspectionId = buildTasksByRoomInspectionId(params.taskResults);
  const photosByRoomInspectionId = new Map<string, ReviewPhotoLike[]>();

  for (const photo of params.photos) {
    const existing = photosByRoomInspectionId.get(photo.roomInspectionId);
    if (existing) {
      existing.push(photo);
    } else {
      photosByRoomInspectionId.set(photo.roomInspectionId, [photo]);
    }
  }

  for (const photos of photosByRoomInspectionId.values()) {
    photos.sort((a, b) => a._creationTime - b._creationTime);
  }

  const rooms = params.roomInspections.map((roomInspection) => {
    const roomTasks = tasksByRoomInspectionId.get(roomInspection._id) ?? [];
    const roomPhotos = photosByRoomInspectionId.get(roomInspection._id) ?? [];
    const issueCount =
      typeof roomInspection.issueCount === "number"
        ? roomInspection.issueCount
        : roomTasks.filter((task) => task.hasIssue).length;

    return {
      room_inspection_id: roomInspection._id,
      room_name: roomInspection.roomName,
      status: roomInspection.status,
      notes: roomInspection.notes ?? null,
      required_photo_min: roomInspection.requiredPhotoMin,
      issue_count: issueCount,
      photo_count: roomPhotos.length,
      tasks: roomTasks.map((task) => ({
        description: task.taskDescription,
        completed: task.completed,
        has_issue: task.hasIssue ?? false,
        issue_notes: task.issueNotes ?? null,
      })),
      photos: roomPhotos.map((photo, index) => ({
        photo_id: photo._id,
        room_inspection_id: roomInspection._id,
        room_name: roomInspection.roomName,
        file_name: photo.fileName,
        file_size: photo.fileSize,
        mime_type: photo.mimeType,
        kind: photo.kind ?? null,
        url: photo.url,
        captured_at: new Date(photo._creationTime).toISOString(),
        export_file_name: buildCompletedPhotoExportFileName({
          propertyName: params.inspection.propertyName,
          checklistType: params.inspection.type,
          roomName: roomInspection.roomName,
          kind: photo.kind,
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          completedAt: params.inspection.completedAt,
          createdAt: photo._creationTime,
          sequence: index + 1,
        }),
      })),
    };
  });

  return {
    property_name: params.inspection.propertyName,
    property_address: params.property?.address ?? "",
    checklist_type: params.inspection.type,
    assignee_name: params.inspection.assigneeName,
    inspection_date: params.inspection.completedAt
      ? new Date(params.inspection.completedAt).toISOString()
      : new Date(params.inspection._creationTime).toISOString(),
    status: params.inspection.status,
    notes: params.inspection.notes ?? null,
    issue_count: rooms.reduce((sum, room) => sum + room.issue_count, 0),
    photo_count: params.photos.length,
    rooms,
  };
}
