import { ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Id } from "convex/_generated/dataModel";
import { Camera } from "lucide-react";
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
  }>;
};

type InspectionRoomPanelProps = {
  inspectionStatus: "IN_PROGRESS" | "COMPLETED";
  room: RoomDetail | null | undefined;
  taskIssueDrafts: Record<string, string>;
  roomNotes: string;
  photoKind: PhotoKind;
  confirmAction: string | null;
  savingTaskId: Id<"taskResults"> | null;
  savingIssueTaskId: Id<"taskResults"> | null;
  savingNotes: boolean;
  uploadingPhotos: boolean;
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

export function InspectionRoomPanel(props: InspectionRoomPanelProps) {
  const {
    inspectionStatus,
    room,
    taskIssueDrafts,
    roomNotes,
    photoKind,
    confirmAction,
    savingTaskId,
    savingIssueTaskId,
    savingNotes,
    uploadingPhotos,
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
  const roomHasEnoughPhotos = room.photos.length >= room.requiredPhotoMin;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{room.roomName}</h3>
          <p className="text-sm text-slate-600">
            {room.taskResults.filter((task) => task.completed).length}/{room.taskResults.length} tasks
            complete | {room.taskResults.filter((task) => task.hasIssue).length} issues |{" "}
            {room.photos.length}/{room.requiredPhotoMin} required photos
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
          <h3 className="font-semibold">Step 2: Upload proof photos</h3>
          <p className="text-sm text-slate-600">
            Upload proof photos for this room. Removing a required photo reopens the room.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="text-sm font-medium text-slate-700">
            Photo Type
            <select
              aria-label="Select photo category"
              className="input mt-1"
              disabled={inspectionStatus === "COMPLETED" || uploadingPhotos}
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
          <label className="text-sm font-medium text-slate-700">
            Add Photos
            <input
              accept="image/*"
              aria-label="Choose photos to upload"
              className="input mt-1 py-2"
              disabled={inspectionStatus === "COMPLETED" || uploadingPhotos}
              multiple
              onChange={(event) => void onPhotoUpload(event)}
              type="file"
            />
          </label>
        </div>

        {room.photos.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Camera className="h-7 w-7" />}
              heading="No photos uploaded yet"
              description="Use the file picker above to add proof photos for this room."
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
                    <img alt={photo.fileName} className="h-40 w-full object-cover" src={photo.url} />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">
                      {photo.isPendingUpload ? "Pending local upload" : "Preview unavailable"}
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
                      {photo.isPendingUpload ? " | queued" : ""}
                    </p>
                  </div>
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
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-slate-50 p-4">
        <div className="mb-2">
          <h3 className="font-semibold">Step 3A: Room notes</h3>
          <p className="text-sm text-slate-600">
            Capture exceptions, follow-up details, or anything the next shift should know.
          </p>
        </div>
        <textarea
          className="input min-h-28"
          disabled={inspectionStatus === "COMPLETED"}
          onChange={(event) => setRoomNotes(event.target.value)}
          value={roomNotes}
        />
        <button
          className="field-button secondary mt-3 px-4"
          disabled={inspectionStatus === "COMPLETED" || savingNotes}
          onClick={() => void onSaveNotes()}
          type="button"
        >
          {savingNotes ? "Saving..." : "Save Room Notes"}
        </button>
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
              {completingRoomId === room._id ? "Completing..." : "Complete Room"}
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
