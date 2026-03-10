type HistoryInspectionLike = {
  _id: string;
  _creationTime: number;
  completedAt?: number;
  propertyName: string;
  type: "CLEANING" | "INSPECTION";
  status: "IN_PROGRESS" | "COMPLETED";
  assigneeName?: string;
  notes?: string;
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
};

export function buildCompletedInspectionHistoryItem(
  inspection: HistoryInspectionLike,
  issueCount: number
) {
  return {
    ...inspection,
    issueCount,
  };
}

export function buildInspectionReport(params: {
  inspection: ReportInspectionLike;
  property: ReportPropertyLike | null;
  roomInspections: ReportRoomLike[];
  taskResults: ReportTaskLike[];
  photoCountByRoomInspectionId: Map<string, number>;
}) {
  const tasksByRoomInspectionId = new Map<string, ReportTaskLike[]>();

  for (const task of params.taskResults) {
    const existing = tasksByRoomInspectionId.get(task.roomInspectionId);
    if (existing) {
      existing.push(task);
    } else {
      tasksByRoomInspectionId.set(task.roomInspectionId, [task]);
    }
  }

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
