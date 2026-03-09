import { openDB } from "idb";

export type CreateInspectionPayload = {
  propertyId: string;
  type: "CLEANING" | "INSPECTION";
  jobId?: string;
};

export type SetTaskCompletedPayload = {
  inspectionId: string;
  roomInspectionId: string;
  taskResultId: string;
  completed: boolean;
  previousCompleted?: boolean;
};

export type SetTaskIssuePayload = {
  inspectionId: string;
  roomInspectionId: string;
  taskResultId: string;
  hasIssue: boolean;
  issueNotes?: string;
  previousHasIssue?: boolean;
};

export type UpdateRoomNotesPayload = {
  inspectionId: string;
  roomInspectionId: string;
  notes: string;
};

export type CompleteRoomPayload = {
  inspectionId: string;
  roomInspectionId: string;
};

export type CompleteInspectionPayload = {
  inspectionId: string;
  notes?: string;
};

export type WorkerEditableStatus = "IN_PROGRESS" | "BLOCKED";

export type UpdateMyJobStatusPayload = {
  jobId: string;
  status: WorkerEditableStatus;
};

export type PhotoKind = "BEFORE" | "AFTER" | "ISSUE" | "GENERAL";

export type UploadPhotoPayload = {
  inspectionId: string;
  roomInspectionId: string;
  localPhotoId: string;
  file: Blob;
  fileName: string;
  fileSize: number;
  mimeType: string;
  kind?: PhotoKind;
};

export type RemovePhotoPayload = {
  inspectionId: string;
  roomInspectionId: string;
  photoId: string;
};

export type OutboxItemStatus =
  | "QUEUED"
  | "PROCESSING"
  | "FAILED"
  | "CONFLICT"
  | "SYNCED";

export type OutboxItemType =
  | "CREATE_INSPECTION"
  | "SET_TASK_COMPLETED"
  | "SET_TASK_ISSUE"
  | "UPDATE_ROOM_NOTES"
  | "UPLOAD_PHOTO"
  | "REMOVE_PHOTO"
  | "COMPLETE_ROOM"
  | "COMPLETE_INSPECTION"
  | "UPDATE_MY_JOB_STATUS";

type BaseOutboxItem<TType extends OutboxItemType, TPayload> = {
  id: string;
  type: TType;
  payload: TPayload;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  status: OutboxItemStatus;
  lastError?: string;
  lastProcessedAt?: number;
  dedupeKey?: string;
  resultId?: string;
};

export type CreateInspectionOutboxItem = BaseOutboxItem<
  "CREATE_INSPECTION",
  CreateInspectionPayload
>;

export type SetTaskCompletedOutboxItem = BaseOutboxItem<
  "SET_TASK_COMPLETED",
  SetTaskCompletedPayload
>;

export type SetTaskIssueOutboxItem = BaseOutboxItem<
  "SET_TASK_ISSUE",
  SetTaskIssuePayload
>;

export type UpdateRoomNotesOutboxItem = BaseOutboxItem<
  "UPDATE_ROOM_NOTES",
  UpdateRoomNotesPayload
>;

export type UploadPhotoOutboxItem = BaseOutboxItem<"UPLOAD_PHOTO", UploadPhotoPayload>;

export type RemovePhotoOutboxItem = BaseOutboxItem<"REMOVE_PHOTO", RemovePhotoPayload>;

export type CompleteRoomOutboxItem = BaseOutboxItem<
  "COMPLETE_ROOM",
  CompleteRoomPayload
>;

export type CompleteInspectionOutboxItem = BaseOutboxItem<
  "COMPLETE_INSPECTION",
  CompleteInspectionPayload
>;

export type UpdateMyJobStatusOutboxItem = BaseOutboxItem<
  "UPDATE_MY_JOB_STATUS",
  UpdateMyJobStatusPayload
>;

export type OutboxItem =
  | CreateInspectionOutboxItem
  | SetTaskCompletedOutboxItem
  | SetTaskIssueOutboxItem
  | UpdateRoomNotesOutboxItem
  | UploadPhotoOutboxItem
  | RemovePhotoOutboxItem
  | CompleteRoomOutboxItem
  | CompleteInspectionOutboxItem
  | UpdateMyJobStatusOutboxItem;

type QueueActionableItem = Exclude<OutboxItem, { status: "SYNCED" | "CONFLICT" }>;

const DB_NAME = "dazzle-divas-v3";
const DB_VERSION = 2;
const STORE = "outbox";

function notifyOutboxChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dazzle:outbox-changed"));
  }
}

function isResolvedStatus(status: OutboxItemStatus) {
  return status === "SYNCED" || status === "CONFLICT";
}

function isActionableStatus(status: OutboxItemStatus) {
  return status !== "SYNCED" && status !== "CONFLICT";
}

function normalizeOutboxItem(raw: Partial<OutboxItem> & { id: string; type: OutboxItemType }) {
  const createdAt = raw.createdAt ?? Date.now();
  const status = raw.status ?? "QUEUED";

  return {
    ...raw,
    createdAt,
    updatedAt: raw.updatedAt ?? createdAt,
    attempts: raw.attempts ?? 0,
    status,
    payload: raw.payload ?? {},
  } as OutboxItem;
}

async function db() {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(database, _oldVersion, _newVersion, transaction) {
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("status", "status");
        return;
      }

      const store = transaction.objectStore(STORE);

      if (!store.indexNames.contains("createdAt")) {
        store.createIndex("createdAt", "createdAt");
      }

      if (!store.indexNames.contains("status")) {
        store.createIndex("status", "status");
      }
    },
  });
}

async function listItemsInternal() {
  const database = await db();
  const items = await database.getAllFromIndex(STORE, "createdAt");
  return (items as Array<Partial<OutboxItem> & { id: string; type: OutboxItemType }>)
    .map(normalizeOutboxItem)
    .sort((left, right) => left.createdAt - right.createdAt);
}

async function putItem(item: OutboxItem) {
  const database = await db();
  await database.put(STORE, item);
  notifyOutboxChanged();
}

async function deleteItems(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const database = await db();
  const transaction = database.transaction(STORE, "readwrite");
  for (const id of ids) {
    await transaction.store.delete(id);
  }
  await transaction.done;
  notifyOutboxChanged();
}

async function deleteMatchingItems(predicate: (item: OutboxItem) => boolean) {
  const items = await listItemsInternal();
  const ids = items.filter(predicate).map((item) => item.id);
  await deleteItems(ids);
}

async function replaceByDedupeKey<T extends OutboxItem>(
  item: T,
  predicate: (existing: OutboxItem) => boolean
) {
  const items = await listItemsInternal();
  const database = await db();
  const transaction = database.transaction(STORE, "readwrite");

  for (const existing of items) {
    if (predicate(existing)) {
      await transaction.store.delete(existing.id);
    }
  }

  await transaction.store.put(item);
  await transaction.done;
  notifyOutboxChanged();
}

function makeBaseItem<TType extends OutboxItemType, TPayload>(
  type: TType,
  payload: TPayload,
  dedupeKey?: string
): BaseOutboxItem<TType, TPayload> {
  const createdAt = Date.now();
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    status: "QUEUED",
    dedupeKey,
  };
}

async function clearPendingInspectionCompletion(inspectionId: string) {
  await deleteMatchingItems(
    (item) =>
      isActionableStatus(item.status) &&
      item.type === "COMPLETE_INSPECTION" &&
      item.payload.inspectionId === inspectionId
  );
}

async function clearPendingRoomCompletion(inspectionId: string, roomInspectionId: string) {
  await deleteMatchingItems(
    (item) =>
      isActionableStatus(item.status) &&
      ((item.type === "COMPLETE_ROOM" &&
        item.payload.roomInspectionId === roomInspectionId) ||
        (item.type === "COMPLETE_INSPECTION" &&
          item.payload.inspectionId === inspectionId))
  );
}

export function isOutboxActionable(item: OutboxItem): item is QueueActionableItem {
  return isActionableStatus(item.status);
}

export function isOutboxResolved(item: OutboxItem) {
  return isResolvedStatus(item.status);
}

export function describeOutboxItem(item: OutboxItem) {
  switch (item.type) {
    case "CREATE_INSPECTION":
      return item.payload.jobId ? "Queued checklist start from schedule" : "Queued checklist start";
    case "SET_TASK_COMPLETED":
      return item.payload.completed ? "Queued task completion" : "Queued task reopen";
    case "SET_TASK_ISSUE":
      return item.payload.hasIssue ? "Queued task issue" : "Queued issue clear";
    case "UPDATE_ROOM_NOTES":
      return "Queued room notes";
    case "UPLOAD_PHOTO":
      return `Queued photo upload: ${item.payload.fileName}`;
    case "REMOVE_PHOTO":
      return "Queued photo removal";
    case "COMPLETE_ROOM":
      return "Queued room completion";
    case "COMPLETE_INSPECTION":
      return "Queued checklist completion";
    case "UPDATE_MY_JOB_STATUS":
      return `Queued worker status: ${item.payload.status}`;
  }
}

export async function queueCreateInspection(payload: CreateInspectionPayload) {
  const item = makeBaseItem(
    "CREATE_INSPECTION",
    payload,
    payload.jobId ? `CREATE_INSPECTION:${payload.jobId}` : undefined
  );

  if (item.dedupeKey) {
    await replaceByDedupeKey(
      item,
      (existing) =>
        isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
    );
  } else {
    await putItem(item);
  }

  return item.id;
}

export async function queueSetTaskCompleted(payload: SetTaskCompletedPayload) {
  const item = makeBaseItem(
    "SET_TASK_COMPLETED",
    payload,
    `TASK_RESULT:${payload.taskResultId}`
  );

  if (!payload.completed) {
    await clearPendingRoomCompletion(payload.inspectionId, payload.roomInspectionId);
  }

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueSetTaskIssue(payload: SetTaskIssuePayload) {
  const item = makeBaseItem(
    "SET_TASK_ISSUE",
    {
      ...payload,
      issueNotes: payload.hasIssue ? payload.issueNotes?.trim() || undefined : undefined,
    },
    `TASK_ISSUE:${payload.taskResultId}`
  );

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueUpdateRoomNotes(payload: UpdateRoomNotesPayload) {
  const item = makeBaseItem(
    "UPDATE_ROOM_NOTES",
    payload,
    `ROOM_NOTES:${payload.roomInspectionId}`
  );

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueUploadPhoto(
  payload: Omit<UploadPhotoPayload, "localPhotoId">
) {
  const item = makeBaseItem("UPLOAD_PHOTO", {
    ...payload,
    localPhotoId: `local-photo:${crypto.randomUUID()}`,
  });

  await putItem(item);
  return item.payload.localPhotoId;
}

export async function removeQueuedLocalPhoto(localPhotoId: string) {
  await deleteMatchingItems(
    (item) =>
      isActionableStatus(item.status) &&
      item.type === "UPLOAD_PHOTO" &&
      item.payload.localPhotoId === localPhotoId
  );
}

export async function queueRemovePhoto(payload: RemovePhotoPayload) {
  await clearPendingRoomCompletion(payload.inspectionId, payload.roomInspectionId);

  const item = makeBaseItem("REMOVE_PHOTO", payload, `REMOVE_PHOTO:${payload.photoId}`);
  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueCompleteRoom(payload: CompleteRoomPayload) {
  const item = makeBaseItem("COMPLETE_ROOM", payload, `COMPLETE_ROOM:${payload.roomInspectionId}`);

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueCompleteInspection(payload: CompleteInspectionPayload) {
  const item = makeBaseItem(
    "COMPLETE_INSPECTION",
    payload,
    `COMPLETE_INSPECTION:${payload.inspectionId}`
  );

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function queueUpdateMyJobStatus(payload: UpdateMyJobStatusPayload) {
  const item = makeBaseItem(
    "UPDATE_MY_JOB_STATUS",
    payload,
    `MY_JOB_STATUS:${payload.jobId}`
  );

  await replaceByDedupeKey(
    item,
    (existing) => isActionableStatus(existing.status) && existing.dedupeKey === item.dedupeKey
  );

  return item.id;
}

export async function getOutboxItems(options?: { includeResolved?: boolean }) {
  const items = await listItemsInternal();
  if (options?.includeResolved) {
    return items;
  }
  return items.filter((item) => !isResolvedStatus(item.status));
}

export async function getOutboxCount() {
  const items = await listItemsInternal();
  return items.filter((item) => !isResolvedStatus(item.status)).length;
}

export async function getActiveOutboxItems() {
  const items = await listItemsInternal();
  return items.filter(isOutboxActionable);
}

export async function getPendingOutboxItems() {
  const items = await listItemsInternal();
  return items.filter((item) => item.status === "QUEUED" || item.status === "FAILED");
}

export async function setOutboxItemProcessing(id: string) {
  const items = await listItemsInternal();
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    return;
  }

  await putItem({
    ...item,
    status: "PROCESSING",
    lastError: undefined,
    updatedAt: Date.now(),
  });
}

export async function setOutboxItemResult(
  id: string,
  params: {
    status: "SYNCED" | "FAILED" | "CONFLICT" | "QUEUED";
    lastError?: string;
    resultId?: string;
  }
) {
  const items = await listItemsInternal();
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    return;
  }

  await putItem({
    ...item,
    status: params.status,
    attempts: params.status === "SYNCED" ? item.attempts : item.attempts + 1,
    updatedAt: Date.now(),
    lastProcessedAt: Date.now(),
    lastError: params.lastError,
    resultId: params.resultId ?? item.resultId,
  });
}

export async function resetProcessingItemsToQueued() {
  const items = await listItemsInternal();
  const processingItems = items.filter((item) => item.status === "PROCESSING");

  if (processingItems.length === 0) {
    return;
  }

  const database = await db();
  const transaction = database.transaction(STORE, "readwrite");

  for (const item of processingItems) {
    await transaction.store.put({
      ...item,
      status: "QUEUED",
      updatedAt: Date.now(),
    });
  }

  await transaction.done;
  notifyOutboxChanged();
}

export async function clearResolvedOutboxItems() {
  await deleteMatchingItems((item) => isResolvedStatus(item.status));
}
