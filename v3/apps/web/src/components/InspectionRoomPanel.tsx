import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Id } from "convex/_generated/dataModel";
import { Camera, ChevronDown, ChevronUp, Download } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/EmptyState";
import type { PhotoKind } from "@/lib/offlineOutbox";
import { roomStatusTone } from "@/lib/statusColors";

type RoomDetail = {
  _id: Id<"roomInspections">;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
  taskResults: Array<{
    _id: Id<"taskResults">;
    taskDescription: string;
    completed: boolean;
    hasIssue?: boolean;
    issueNotes?: string;
  }>;
  photos: Array<{
    _id: Id<"photos"> | string;
    fileName: string;
    mimeType: string;
    kind?: PhotoKind;
    url: string | null;
    isPendingUpload?: boolean;
    hasConflict?: boolean;
    blob?: Blob;
  }>;
};

type InspectionRoomPanelProps = {
  inspectionStatus: "IN_PROGRESS" | "COMPLETED";
  room: RoomDetail | null | undefined;
  taskIssueDrafts: Record<string, string>;
  roomNotes: string;
  photoKind: PhotoKind;
  pendingDirectPhotoCount: number;
  confirmAction: string | null;
  savingTaskId: Id<"taskResults"> | null;
  savingIssueTaskId: Id<"taskResults"> | null;
  savingNotes: boolean;
  removingPhotoId: Id<"photos"> | null;
  completingRoomId: Id<"roomInspections"> | null;
  canCompleteRoom: boolean;
  setTaskIssueDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setRoomNotes: Dispatch<SetStateAction<string>>;
  setPhotoKind: Dispatch<SetStateAction<PhotoKind>>;
  setConfirmAction: Dispatch<SetStateAction<string | null>>;
  onTaskToggle: (taskResultId: Id<"taskResults">, completed: boolean) => Promise<void>;
  onTaskIssueSave: (taskResultId: Id<"taskResults">, hasIssue: boolean) => Promise<void>;
  onSaveNotes: () => Promise<void>;
  onPhotoUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemovePhoto: (photo: { _id: string; isPendingUpload?: boolean }) => Promise<void>;
  onCompleteRoom: () => Promise<void>;
};

function supportsNativeFileShare() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function savePhotoBackup(photo: { blob?: Blob; fileName: string; mimeType: string }) {
  if (!photo.blob) {
    throw new Error("Local photo backup is unavailable right now");
  }

  const file = new File([photo.blob], photo.fileName, {
    type: photo.mimeType || photo.blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });

  if (supportsNativeFileShare()) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: photo.fileName,
          text: "Local checklist photo backup",
        });
        return "shared";
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      throw error;
    }
  }

  triggerBlobDownload(photo.blob, photo.fileName);
  return "downloaded";
}

function PendingPhotoPreview({ blob, alt }: { blob?: Blob; alt: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  if (!previewUrl) {
    return (
      <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">
        Preview unavailable
      </div>
    );
  }

  return <img alt={alt} className="h-40 w-full object-cover" src={previewUrl} />;
}

export function InspectionRoomPanel(props: InspectionRoomPanelProps) {
  const {
    inspectionStatus,
    room,
    taskIssueDrafts,
    roomNotes,
    photoKind,
    pendingDirectPhotoCount,
    confirmAction,
    savingTaskId,
    savingIssueTaskId,
    savingNotes,
    removingPhotoId,
    completingRoomId,
    canCompleteRoom,
    setTaskIssueDrafts,
    setRoomNotes,
    setPhotoKind,
    setConfirmAction,
    onTaskToggle,
    onTaskIssueSave,
    onSaveNotes,
    onPhotoUpload,
    onRemovePhoto,
    onCompleteRoom,
  } = props;
  const [savingBackupId, setSavingBackupId] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNotesExpanded(false);
  }, [room?._id]);

  useEffect(() => {
    if (roomNotes.trim().length > 0) {
      setNotesExpanded(true);
    }
  }, [roomNotes]);

  if (room === undefined) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-6 w-2/3 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    );
  }

  if (!room) {
    return <p className="text-sm text-slate-500">Room not found.</p>;
  }

  const roomTasksComplete = room.taskResults.every((task) => task.completed);
  const effectivePhotoCount = room.photos.length + pendingDirectPhotoCount;
  const roomHasEnoughPhotos = effectivePhotoCount >= room.requiredPhotoMin;
  const hasAnyPhotoCards = room.photos.length > 0 || pendingDirectPhotoCount > 0;
  const prefersAndroidCameraCapture =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  function openCameraInput() {
    if (inspectionStatus === "COMPLETED") {
      return;
    }

    cameraInputRef.current?.click();
  }

  function openGalleryInput() {
    if (inspectionStatus === "COMPLETED") {
      return;
    }

    galleryInputRef.current?.click();
  }

  async function handleSaveBackup(photo: RoomDetail["photos"][number]) {
    setSavingBackupId(String(photo._id));

    try {
      const result = await savePhotoBackup(photo);
      if (result === "shared") {
        toast.success(`Opened save options for ${photo.fileName}`);
      } else if (result === "downloaded") {
        toast.success(`Downloaded backup copy of ${photo.fileName}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save backup photo");
    } finally {
      setSavingBackupId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{room.roomName}</h3>
          <p className="text-sm text-slate-600">
            {room.taskResults.filter((task) => task.completed).length}/{room.taskResults.length} tasks
            complete | {room.taskResults.filter((task) => task.hasIssue).length} issues |{" "}
            {effectivePhotoCount}/{room.requiredPhotoMin} required photos
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${roomStatusTone(
            room.status
          )}`}
        >
          {room.status}
        </span>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Step 1: Complete room tasks</h3>
        <div className="space-y-2">
          {room.taskResults.map((task) => (
            <div
              key={task._id}
              className={`block rounded-2xl border p-3 ${
                task.hasIssue ? "border-rose-200 bg-rose-50" : "border-border bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Mark ${task.taskDescription} as ${task.completed ? "incomplete" : "complete"}`}
                  checked={task.completed}
                  disabled={inspectionStatus === "COMPLETED" || savingTaskId === task._id}
                  onChange={(event) => void onTaskToggle(task._id, event.target.checked)}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className={task.completed ? "text-slate-500 line-through" : "text-slate-700"}>
                      {task.taskDescription}
                    </span>
                    {task.hasIssue ? (
                      <span className="rounded-full border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700">
                        Issue Flagged
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="field-button secondary px-3"
                        disabled={
                          inspectionStatus === "COMPLETED" ||
                          savingIssueTaskId === task._id ||
                          task.hasIssue === true
                        }
                        onClick={() => void onTaskIssueSave(task._id, true)}
                        type="button"
                      >
                        Flag Issue
                      </button>
                      <button
                        className="field-button secondary px-3"
                        disabled={
                          inspectionStatus === "COMPLETED" ||
                          savingIssueTaskId === task._id ||
                          !task.hasIssue
                        }
                        onClick={() => void onTaskIssueSave(task._id, false)}
                        type="button"
                      >
                        Clear Issue
                      </button>
                    </div>
                    {task.hasIssue ? (
                      <div className="space-y-2">
                        <textarea
                          className="input min-h-24"
                          disabled={inspectionStatus === "COMPLETED"}
                          onChange={(event) =>
                            setTaskIssueDrafts((current) => ({
                              ...current,
                              [task._id]: event.target.value,
                            }))
                          }
                          placeholder="Describe what was wrong or what needs follow-up"
                          value={taskIssueDrafts[task._id] ?? ""}
                        />
                        <button
                          className="field-button secondary px-3"
                          disabled={inspectionStatus === "COMPLETED" || savingIssueTaskId === task._id}
                          onClick={() => void onTaskIssueSave(task._id, true)}
                          type="button"
                        >
                          {savingIssueTaskId === task._id ? "Saving..." : "Save Issue Note"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-brand-300 bg-slate-50 p-4">
        <div className="mb-3">
          <h3 className="font-semibold">Step 2: Add proof photos</h3>
          <p className="text-sm text-slate-600">
            {prefersAndroidCameraCapture
              ? "Add Photo opens the camera on Android. Use Gallery when you need to attach an existing image."
              : "Use your device's normal photo picker. On phones, this should offer the familiar menu to take a photo or choose one from the library."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="text-sm font-medium text-slate-700">
            Photo Type
            <select
              aria-label="Select photo category"
              className="input mt-1"
              disabled={inspectionStatus === "COMPLETED"}
              onChange={(event) => setPhotoKind(event.target.value as PhotoKind)}
              value={photoKind}
            >
              {["BEFORE", "AFTER", "ISSUE", "GENERAL"].map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 text-sm font-medium text-slate-700">
            <span className="block">Add Photos</span>
            <div className="flex flex-wrap gap-2">
              <button
                className="field-button primary inline-flex items-center px-4"
                disabled={inspectionStatus === "COMPLETED"}
                onClick={openCameraInput}
                type="button"
              >
                <Camera className="mr-2 h-4 w-4" />
                Add Photo
              </button>
              {prefersAndroidCameraCapture ? (
                <button
                  className="field-button secondary inline-flex items-center px-4"
                  disabled={inspectionStatus === "COMPLETED"}
                  onClick={openGalleryInput}
                  type="button"
                >
                  Gallery
                </button>
              ) : null}
              <input
                accept="image/*"
                aria-label={prefersAndroidCameraCapture ? "Take photo" : "Add photo"}
                capture={prefersAndroidCameraCapture ? "environment" : undefined}
                className="sr-only"
                disabled={inspectionStatus === "COMPLETED"}
                multiple={!prefersAndroidCameraCapture}
                onChange={(event) => void onPhotoUpload(event)}
                ref={cameraInputRef}
                type="file"
              />
              {prefersAndroidCameraCapture ? (
                <input
                  accept="image/*"
                  aria-label="Choose photo from gallery"
                  className="sr-only"
                  disabled={inspectionStatus === "COMPLETED"}
                  multiple
                  onChange={(event) => void onPhotoUpload(event)}
                  ref={galleryInputRef}
                  type="file"
                />
              ) : null}
            </div>
            <p className="text-xs font-normal text-slate-500">
              Pending local photos can be backed up to Photos or Files below if you need a manual
              fallback.
            </p>
            {pendingDirectPhotoCount > 0 ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                {pendingDirectPhotoCount} photo{pendingDirectPhotoCount === 1 ? "" : "s"} uploading
              </p>
            ) : null}
          </div>
        </div>

        {!hasAnyPhotoCards ? (
          <div className="mt-3">
            <EmptyState
              icon={<Camera className="h-7 w-7" />}
              heading="No photos captured yet"
              description={
                prefersAndroidCameraCapture
                  ? "Tap Add Photo to open the camera, or Gallery to attach an existing image."
                  : "Tap Add Photo to use your device's normal camera or library flow."
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {room.photos.map((photo) => (
              <div
                key={photo._id}
                className="overflow-hidden rounded-2xl border border-border bg-white"
              >
                <div className="relative">
                  {photo.url ? (
                    <img
                      alt={photo.fileName}
                      className="h-40 w-full object-cover"
                      decoding="async"
                      loading="lazy"
                      src={photo.url}
                    />
                  ) : photo.blob ? (
                    <PendingPhotoPreview alt={photo.fileName} blob={photo.blob} />
                  ) : (
                    <div className={`flex h-40 items-center justify-center text-sm ${
                      photo.hasConflict
                        ? "bg-rose-50 text-rose-600"
                        : photo.isPendingUpload
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}>
                      {photo.hasConflict
                        ? "Sync needs review"
                        : photo.isPendingUpload
                          ? "Queued — waiting to upload"
                          : "Preview unavailable"}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {photo.kind ?? "GENERAL"}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <div>
                    <p className="text-sm font-semibold">{photo.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {photo.kind ?? "GENERAL"}
                      {photo.hasConflict
                        ? <span className="font-semibold text-rose-600"> | needs review</span>
                        : photo.isPendingUpload
                          ? <span className="font-semibold text-amber-600"> | queued locally</span>
                          : ""}
                    </p>
                  </div>
                  {photo.blob ? (
                    <button
                      className="field-button secondary w-full px-3"
                      disabled={savingBackupId === String(photo._id)}
                      onClick={() => void handleSaveBackup(photo)}
                      type="button"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {savingBackupId === String(photo._id) ? "Opening..." : "Save Backup"}
                    </button>
                  ) : null}
                  {confirmAction === `removePhoto:${photo._id}` ? (
                    <div className="animate-slide-up flex gap-2">
                      <button
                        className="field-button danger flex-1 px-3"
                        disabled={removingPhotoId === photo._id}
                        onClick={() => {
                          setConfirmAction(null);
                          void onRemovePhoto({
                            _id: String(photo._id),
                            isPendingUpload: photo.isPendingUpload,
                          });
                        }}
                        type="button"
                      >
                        {removingPhotoId === photo._id ? "Removing..." : "Confirm"}
                      </button>
                      <button
                        className="field-button ghost flex-1 px-3"
                        onClick={() => setConfirmAction(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="field-button danger w-full px-3"
                      disabled={inspectionStatus === "COMPLETED" || removingPhotoId === photo._id}
                      onClick={() => setConfirmAction(`removePhoto:${photo._id}`)}
                      type="button"
                    >
                      {removingPhotoId === photo._id ? "Removing..." : "Remove Photo"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {Array.from({ length: pendingDirectPhotoCount }).map((_, index) => (
              <div
                key={`pending-direct-photo-${index}`}
                className="overflow-hidden rounded-2xl border border-brand-200 bg-white"
              >
                <div className="flex h-40 flex-col items-center justify-center gap-2 bg-brand-50/50">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-400" />
                  <span className="text-sm font-semibold text-brand-700">Uploading...</span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="text-sm font-semibold text-slate-800">Upload in progress</p>
                  <p className="text-xs text-slate-500">
                    This photo will appear here when the upload finishes.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={`rounded-2xl border transition ${
          notesExpanded
            ? "border-border bg-slate-50 p-3"
            : "border-border/80 bg-white px-3 py-2"
        }`}
      >
        <button
          aria-expanded={notesExpanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setNotesExpanded((current) => !current)}
          type="button"
        >
          <div>
            <h3 className="font-semibold">Step 3A: Room Notes</h3>
          </div>
          <div className="flex items-center gap-2">
            {notesExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </div>
        </button>
        {notesExpanded ? (
          <div className="mt-3 space-y-3">
            <textarea
              className="input min-h-20"
              disabled={inspectionStatus === "COMPLETED"}
              onChange={(event) => setRoomNotes(event.target.value)}
              placeholder="Add optional room notes"
              value={roomNotes}
            />
            <div className="flex justify-end">
              <button
                className="field-button secondary px-4"
                disabled={inspectionStatus === "COMPLETED" || savingNotes}
                onClick={() => void onSaveNotes()}
                type="button"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3">
          <h3 className="font-semibold">Step 3B: Finish room</h3>
          <p className="text-sm text-slate-600">
            A room can only be completed when every task is checked and the photo minimum is met.
          </p>
        </div>
        {!roomTasksComplete || !roomHasEnoughPhotos ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {!roomTasksComplete ? <p>Finish all tasks before completing this room.</p> : null}
            {!roomHasEnoughPhotos ? (
              <p>
                Upload at least {room.requiredPhotoMin} photo(s) for this room before completing it.
              </p>
            ) : null}
          </div>
        ) : null}
        {confirmAction === "completeRoom" ? (
          <div className="animate-slide-up flex gap-2">
            <button
              className="field-button danger flex-1 px-4"
              disabled={completingRoomId === room._id}
              onClick={() => {
                setConfirmAction(null);
                void onCompleteRoom();
              }}
              type="button"
            >
              {completingRoomId === room._id ? "Completing..." : "Mark Room Complete"}
            </button>
            <button
              className="field-button ghost flex-1 px-4"
              onClick={() => setConfirmAction(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="field-button primary w-full px-5"
            disabled={!canCompleteRoom || completingRoomId === room._id}
            onClick={() => setConfirmAction("completeRoom")}
            type="button"
          >
            {completingRoomId === room._id
              ? "Completing Room..."
              : room.status === "COMPLETED"
                ? "Room Completed"
                : "Mark Room Complete"}
          </button>
        )}
      </div>
    </div>
  );
}
