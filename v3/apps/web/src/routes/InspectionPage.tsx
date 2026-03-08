import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import {
  queueCompleteInspection,
  queueCompleteRoom,
  queueRemovePhoto,
  queueSetTaskCompleted,
  queueUpdateRoomNotes,
  queueUploadPhoto,
  removeQueuedLocalPhoto,
  type PhotoKind,
} from "@/lib/offlineOutbox";
import { applyInspectionOutboxOverlay } from "@/lib/offlineInspectionState";

type RoomSummary = {
  _id: Id<"roomInspections">;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
  completedTasks: number;
  totalTasks: number;
  photoCount: number;
};

type InspectionDetail = {
  _id: Id<"inspections">;
  propertyName: string;
  type: "CLEANING" | "INSPECTION";
  status: "IN_PROGRESS" | "COMPLETED";
  notes?: string;
  roomInspections: RoomSummary[];
};

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
  }>;
  photos: Array<{
    _id: Id<"photos">;
    fileName: string;
    mimeType: string;
    kind?: PhotoKind;
    url: string | null;
  }>;
};

const photoKinds: PhotoKind[] = ["BEFORE", "AFTER", "ISSUE", "GENERAL"];

function roomStatusTone(status: RoomSummary["status"]) {
  return status === "COMPLETED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
}

function stepTone(completed: boolean) {
  return completed
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

export function InspectionPage() {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const params = useParams();
  const inspectionId = params.inspectionId as Id<"inspections"> | undefined;

  const inspection = useQuery(
    api.inspections.getById,
    inspectionId ? { inspectionId } : "skip"
  ) as InspectionDetail | null | undefined;
  const { items: outboxItems } = useOutboxItems({ includeResolved: true });

  const [selectedRoomId, setSelectedRoomId] = useState<Id<"roomInspections"> | null>(null);
  const selectedRoom = useQuery(
    api.roomInspections.getById,
    selectedRoomId ? { roomInspectionId: selectedRoomId } : "skip"
  ) as RoomDetail | null | undefined;

  const completeInspection = useMutation(api.inspections.complete);
  const setTaskCompleted = useMutation(api.taskResults.setCompleted);
  const updateRoomNotes = useMutation(api.roomInspections.updateNotes);
  const completeRoom = useMutation(api.roomInspections.complete);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.save);
  const removePhoto = useMutation(api.photos.remove);

  const [roomNotes, setRoomNotes] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [photoKind, setPhotoKind] = useState<PhotoKind>("AFTER");
  const [savingTaskId, setSavingTaskId] = useState<Id<"taskResults"> | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<Id<"photos"> | null>(null);
  const [completingRoomId, setCompletingRoomId] = useState<Id<"roomInspections"> | null>(null);
  const [completingInspection, setCompletingInspection] = useState(false);

  const inspectionOverlay = useMemo(
    () => applyInspectionOutboxOverlay(inspection, selectedRoom, outboxItems),
    [inspection, outboxItems, selectedRoom]
  );
  const inspectionView = inspectionOverlay.inspection;
  const selectedRoomView = inspectionOverlay.selectedRoom;
  const inspectionQueueItems = useMemo(() => {
    if (!inspectionId) {
      return [];
    }

    return outboxItems.filter((item) => {
      if (item.type === "CREATE_INSPECTION" || item.type === "UPDATE_MY_JOB_STATUS") {
        return false;
      }

      return "inspectionId" in item.payload && item.payload.inspectionId === inspectionId;
    });
  }, [inspectionId, outboxItems]);

  const totals = useMemo(() => {
    const rooms = inspectionView?.roomInspections ?? [];
    return {
      rooms: rooms.length,
      completedRooms: rooms.filter((room) => room.status === "COMPLETED").length,
      totalTasks: rooms.reduce((sum, room) => sum + room.totalTasks, 0),
      completedTasks: rooms.reduce((sum, room) => sum + room.completedTasks, 0),
      photos: rooms.reduce((sum, room) => sum + room.photoCount, 0),
    };
  }, [inspectionView]);

  useEffect(() => {
    if (!inspectionView || inspectionView.roomInspections.length === 0) {
      setSelectedRoomId(null);
      return;
    }

    if (
      !selectedRoomId ||
      !inspectionView.roomInspections.some((room) => room._id === selectedRoomId)
    ) {
      setSelectedRoomId(inspectionView.roomInspections[0]._id);
    }
  }, [inspectionView, selectedRoomId]);

  useEffect(() => {
    if (selectedRoom) {
      setRoomNotes(selectedRoom.notes ?? "");
    }
  }, [selectedRoom?._id]);

  useEffect(() => {
    if (inspectionView) {
      setInspectionNotes(inspectionView.notes ?? "");
    }
  }, [inspectionView?._id]);

  if (!inspectionId) {
    return <p className="text-slate-600">Missing inspection id.</p>;
  }

  async function handleTaskToggle(taskResultId: Id<"taskResults">, completed: boolean) {
    setSavingTaskId(taskResultId);

    try {
      if (!inspectionId || !selectedRoomView) {
        return;
      }

      if (!isOnline) {
        const task = selectedRoomView.taskResults.find((candidate) => candidate._id === taskResultId);
        await queueSetTaskCompleted({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          taskResultId,
          completed,
          previousCompleted: task?.completed,
        });
        toast.success("Task update queued for sync");
        return;
      }

      await setTaskCompleted({
        taskResultId,
        completed,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleSaveNotes() {
    if (!inspectionId || !selectedRoomView) {
      return;
    }

    setSavingNotes(true);
    try {
      if (!isOnline) {
        await queueUpdateRoomNotes({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          notes: roomNotes.trim(),
        });
        toast.success("Room notes saved offline");
        return;
      }

      await updateRoomNotes({
        roomInspectionId: selectedRoomView._id,
        notes: roomNotes.trim(),
      });
      toast.success("Room notes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save room notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!inspectionId || !selectedRoomView || files.length === 0) {
      return;
    }

    if (!isOnline) {
      for (const file of files) {
        await queueUploadPhoto({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          kind: photoKind,
        });
      }

      toast.success(`Saved ${files.length} photo${files.length === 1 ? "" : "s"} for sync`);
      event.target.value = "";
      return;
    }

    setUploadingPhotos(true);
    let uploaded = 0;

    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl({
          roomInspectionId: selectedRoomView._id,
        });

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const { storageId } = (await response.json()) as { storageId?: Id<"_storage"> };
        if (!storageId) {
          throw new Error(`Upload did not return a storage id for ${file.name}`);
        }

        await savePhoto({
          storageId,
          roomInspectionId: selectedRoomView._id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          kind: photoKind,
        });

        uploaded += 1;
      }

      toast.success(`Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setUploadingPhotos(false);
      event.target.value = "";
    }
  }

  async function handleRemovePhoto(photo: {
    _id: string;
    isPendingUpload?: boolean;
  }) {
    if (!inspectionId || !selectedRoomView) {
      return;
    }

    if (photo.isPendingUpload) {
      await removeQueuedLocalPhoto(photo._id);
      toast.success("Queued photo removed");
      return;
    }

    setRemovingPhotoId(photo._id as Id<"photos">);
    try {
      if (!isOnline) {
        await queueRemovePhoto({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          photoId: photo._id,
        });
        toast.success("Photo removal queued for sync");
        return;
      }

      await removePhoto({ photoId: photo._id as Id<"photos"> });
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove photo");
    } finally {
      setRemovingPhotoId(null);
    }
  }

  async function handleCompleteRoom() {
    if (!inspectionId || !selectedRoomView) {
      return;
    }

    setCompletingRoomId(selectedRoomView._id);
    try {
      if (!isOnline) {
        await queueCompleteRoom({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
        });
        toast.success("Room completion queued for sync");
      } else {
        await completeRoom({ roomInspectionId: selectedRoomView._id });
        toast.success("Room marked complete");
      }

      const nextPendingRoom = inspectionView?.roomInspections.find(
        (room) => room._id !== selectedRoomView._id && room.status !== "COMPLETED"
      );
      if (nextPendingRoom) {
        setSelectedRoomId(nextPendingRoom._id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete room");
    } finally {
      setCompletingRoomId(null);
    }
  }

  async function handleCompleteInspection() {
    if (!inspectionId) {
      return;
    }

    setCompletingInspection(true);
    try {
      if (!isOnline) {
        await queueCompleteInspection({
          inspectionId,
          notes: inspectionNotes.trim() || undefined,
        });
        toast.success("Checklist completion queued for sync");
        return;
      }

      await completeInspection({
        inspectionId,
        notes: inspectionNotes.trim() || undefined,
      });
      toast.success("Checklist marked as completed");
      navigate("/history");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete checklist");
    } finally {
      setCompletingInspection(false);
    }
  }

  if (inspectionView === undefined) {
    return <p className="text-slate-600">Loading checklist...</p>;
  }

  if (!inspectionView) {
    return <p className="text-slate-600">Checklist not found.</p>;
  }

  const selectedRoomSummary =
    inspectionView.roomInspections.find((room) => room._id === selectedRoomId) ?? null;
  const roomTasksComplete =
    selectedRoomView?.taskResults.every((task) => task.completed) ?? false;
  const roomHasEnoughPhotos =
    selectedRoomView !== undefined && selectedRoomView !== null
      ? selectedRoomView.photos.length >= selectedRoomView.requiredPhotoMin
      : false;
  const canCompleteSelectedRoom =
    inspectionView.status !== "COMPLETED" &&
    selectedRoomView !== null &&
    selectedRoomView !== undefined &&
    roomTasksComplete &&
    roomHasEnoughPhotos &&
    selectedRoomView.status !== "COMPLETED";

  const hasNoRooms = inspectionView.roomInspections.length === 0;
  const nextPendingRoom = inspectionView.roomInspections.find((room) => room.status !== "COMPLETED");
  const roomsRemaining = totals.rooms - totals.completedRooms;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            {inspectionView.type}
          </p>
          <h1 className="text-2xl font-bold">{inspectionView.propertyName}</h1>
          <p className="text-sm text-slate-600">Status: {inspectionView.status}</p>
        </div>
        <div className="max-w-sm rounded-2xl border border-border bg-white p-3 text-sm text-slate-600">
          {isOnline
            ? "Live sync active. Any queued field edits will replay automatically."
            : "Offline detected. Field edits are being queued on this device."}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Rooms" value={`${totals.completedRooms}/${totals.rooms}`} />
        <SummaryCard label="Tasks" value={`${totals.completedTasks}/${totals.totalTasks}`} />
        <SummaryCard label="Photos" value={String(totals.photos)} />
        <SummaryCard label="Selected Room" value={selectedRoomSummary?.roomName ?? "None"} />
      </section>

      <OfflineQueuePanel
        description="Checklist actions, room notes, room completion, and photo uploads queue locally and replay when connection returns."
        items={inspectionQueueItems}
        maxItems={4}
        title="Checklist Sync Status"
      />

      {!hasNoRooms && nextPendingRoom ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Field Progress</h2>
              <p className="text-sm text-slate-600">
                {roomsRemaining} room{roomsRemaining === 1 ? "" : "s"} remaining. Focus on one
                room at a time and move in order.
              </p>
            </div>
            <button
              className="field-button secondary px-4"
              onClick={() => setSelectedRoomId(nextPendingRoom._id)}
              type="button"
            >
              Jump to {nextPendingRoom.roomName}
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.6fr)]">
        <aside className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Rooms</h2>
            <p className="text-sm text-slate-600">
              Work through each room until tasks and photos meet completion requirements.
            </p>
          </div>
          {hasNoRooms ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">No room templates were added to this checklist.</p>
              <p className="mt-2">
                This usually means the room/task template library is empty for the selected checklist
                type. New checklists only include rooms that have tasks configured.
              </p>
              <p className="mt-2">
                Admins can fix this in <Link className="font-semibold underline" to="/admin/templates">Checklist Templates</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {inspectionView.roomInspections.map((room) => (
                <button
                  key={room._id}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedRoomId === room._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-slate-50 hover:border-brand-300"
                  }`}
                  onClick={() => setSelectedRoomId(room._id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{room.roomName}</p>
                      <p className="text-xs text-slate-500">
                        Tasks {room.completedTasks}/{room.totalTasks} | Photos {room.photoCount}/
                        {room.requiredPhotoMin}
                      </p>
                      {room.status !== "COMPLETED" ? (
                        <p className="mt-1 text-xs text-amber-700">
                          {room.totalTasks - room.completedTasks} tasks left and{" "}
                          {Math.max(0, room.requiredPhotoMin - room.photoCount)} photos still needed
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-emerald-700">Room completed and ready.</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${roomStatusTone(
                        room.status
                      )}`}
                    >
                      {room.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4">
            {!selectedRoomId ? (
              <p className="text-sm text-slate-500">Select a room to start executing work.</p>
            ) : selectedRoomView === undefined ? (
              <p className="text-sm text-slate-500">Loading room details...</p>
            ) : !selectedRoomView ? (
              <p className="text-sm text-slate-500">Room not found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedRoomView.roomName}</h2>
                    <p className="text-sm text-slate-600">
                      {selectedRoomView.taskResults.filter((task) => task.completed).length}/
                      {selectedRoomView.taskResults.length} tasks complete |{" "}
                      {selectedRoomView.photos.length}/{selectedRoomView.requiredPhotoMin} required photos
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${roomStatusTone(
                      selectedRoomView.status
                    )}`}
                  >
                    {selectedRoomView.status}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`rounded-2xl border p-3 ${stepTone(roomTasksComplete)}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 1</p>
                    <p className="mt-1 font-semibold">Complete tasks</p>
                    <p className="mt-1 text-sm">
                      {selectedRoomView.taskResults.filter((task) => task.completed).length}/
                      {selectedRoomView.taskResults.length} complete
                    </p>
                  </div>
                  <div className={`rounded-2xl border p-3 ${stepTone(roomHasEnoughPhotos)}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 2</p>
                    <p className="mt-1 font-semibold">Upload proof photos</p>
                    <p className="mt-1 text-sm">
                      {selectedRoomView.photos.length}/{selectedRoomView.requiredPhotoMin} required
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl border p-3 ${stepTone(
                      selectedRoomView.status === "COMPLETED"
                    )}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 3</p>
                    <p className="mt-1 font-semibold">Finish room</p>
                    <p className="mt-1 text-sm">
                      {selectedRoomView.status === "COMPLETED"
                        ? "Room is complete"
                        : "Mark complete after tasks and photos"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold">Step 1: Complete room tasks</h3>
                  <div className="space-y-2">
                    {selectedRoomView.taskResults.map((task) => (
                      <label
                        key={task._id}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-slate-50 p-3"
                      >
                        <input
                          checked={task.completed}
                          disabled={inspectionView.status === "COMPLETED" || savingTaskId === task._id}
                          onChange={(event) =>
                            void handleTaskToggle(task._id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span className={task.completed ? "text-slate-500 line-through" : "text-slate-700"}>
                          {task.taskDescription}
                        </span>
                      </label>
                    ))}
                  </div>
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
                    disabled={inspectionView.status === "COMPLETED"}
                    onChange={(event) => setRoomNotes(event.target.value)}
                    value={roomNotes}
                  />
                  <button
                    className="field-button secondary mt-3 px-4"
                    disabled={inspectionView.status === "COMPLETED" || savingNotes}
                    onClick={() => void handleSaveNotes()}
                    type="button"
                  >
                    {savingNotes ? "Saving..." : "Save Room Notes"}
                  </button>
                </div>

                <div className="rounded-2xl border border-border bg-slate-50 p-4">
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
                        className="input mt-1"
                        disabled={inspectionView.status === "COMPLETED" || uploadingPhotos}
                        onChange={(event) => setPhotoKind(event.target.value as PhotoKind)}
                        value={photoKind}
                      >
                        {photoKinds.map((kind) => (
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
                        className="input mt-1 py-2"
                        disabled={inspectionView.status === "COMPLETED" || uploadingPhotos}
                        multiple
                        onChange={(event) => void handlePhotoUpload(event)}
                        type="file"
                      />
                    </label>
                  </div>

                  {selectedRoomView.photos.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No photos uploaded yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedRoomView.photos.map((photo) => (
                        <div
                          key={photo._id}
                          className="overflow-hidden rounded-2xl border border-border bg-white"
                        >
                          {photo.url ? (
                            <img
                              alt={photo.fileName}
                              className="h-40 w-full object-cover"
                              src={photo.url}
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">
                              {"isPendingUpload" in photo && photo.isPendingUpload
                                ? "Pending local upload"
                                : "Preview unavailable"}
                            </div>
                          )}
                          <div className="space-y-2 p-3">
                            <div>
                              <p className="text-sm font-semibold">{photo.fileName}</p>
                              <p className="text-xs text-slate-500">
                                {photo.kind ?? "GENERAL"}
                                {"isPendingUpload" in photo && photo.isPendingUpload
                                  ? " | queued"
                                  : ""}
                              </p>
                            </div>
                            <button
                              className="field-button secondary w-full px-3"
                              disabled={
                                inspectionView.status === "COMPLETED" ||
                                removingPhotoId === photo._id
                              }
                              onClick={() => void handleRemovePhoto(photo)}
                              type="button"
                            >
                              {removingPhotoId === photo._id ? "Removing..." : "Remove Photo"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold">Step 3B: Finish room</h3>
                    <p className="text-sm text-slate-600">
                      A room can only be completed when every task is checked and the photo minimum
                      is met.
                    </p>
                  </div>
                  {!roomTasksComplete || !roomHasEnoughPhotos ? (
                    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {!roomTasksComplete ? (
                        <p>Finish all tasks before completing this room.</p>
                      ) : null}
                      {!roomHasEnoughPhotos ? (
                        <p>
                          Upload at least {selectedRoomView.requiredPhotoMin} photo(s) for this room
                          before completing it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    className="field-button primary w-full px-5"
                    disabled={!canCompleteSelectedRoom || completingRoomId === selectedRoomView._id}
                    onClick={() => void handleCompleteRoom()}
                    type="button"
                  >
                    {completingRoomId === selectedRoomView._id
                      ? "Completing Room..."
                      : selectedRoomView.status === "COMPLETED"
                        ? "Room Completed"
                        : "Mark Room Complete"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">Finalize Checklist</h2>
              <p className="text-sm text-slate-600">
                Complete the final checklist only after every room is marked complete.
              </p>
            </div>
            <textarea
              className="input min-h-28"
              disabled={inspectionView.status === "COMPLETED"}
              onChange={(event) => setInspectionNotes(event.target.value)}
              placeholder="Add overall inspection notes or shift summary"
              value={inspectionNotes}
            />
            <button
              className="field-button primary mt-3 w-full px-5"
              disabled={inspectionView.status === "COMPLETED" || completingInspection}
              onClick={() => void handleCompleteInspection()}
              type="button"
            >
              {completingInspection
                ? "Completing Checklist..."
                : inspectionView.status === "COMPLETED"
                  ? "Checklist Completed"
                  : "Complete Checklist"}
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
