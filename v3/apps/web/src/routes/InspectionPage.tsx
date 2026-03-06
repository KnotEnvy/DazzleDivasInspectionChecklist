import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

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

type PhotoKind = "BEFORE" | "AFTER" | "ISSUE" | "GENERAL";

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

  const totals = useMemo(() => {
    const rooms = inspection?.roomInspections ?? [];
    return {
      rooms: rooms.length,
      completedRooms: rooms.filter((room) => room.status === "COMPLETED").length,
      totalTasks: rooms.reduce((sum, room) => sum + room.totalTasks, 0),
      completedTasks: rooms.reduce((sum, room) => sum + room.completedTasks, 0),
      photos: rooms.reduce((sum, room) => sum + room.photoCount, 0),
    };
  }, [inspection]);

  useEffect(() => {
    if (!inspection || inspection.roomInspections.length === 0) {
      setSelectedRoomId(null);
      return;
    }

    if (
      !selectedRoomId ||
      !inspection.roomInspections.some((room) => room._id === selectedRoomId)
    ) {
      setSelectedRoomId(inspection.roomInspections[0]._id);
    }
  }, [inspection, selectedRoomId]);

  useEffect(() => {
    if (selectedRoom) {
      setRoomNotes(selectedRoom.notes ?? "");
    }
  }, [selectedRoom?._id]);

  useEffect(() => {
    if (inspection) {
      setInspectionNotes(inspection.notes ?? "");
    }
  }, [inspection?._id]);

  if (!inspectionId) {
    return <p className="text-slate-600">Missing inspection id.</p>;
  }

  async function handleTaskToggle(taskResultId: Id<"taskResults">, completed: boolean) {
    setSavingTaskId(taskResultId);

    try {
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
    if (!selectedRoom) {
      return;
    }

    setSavingNotes(true);
    try {
      await updateRoomNotes({
        roomInspectionId: selectedRoom._id,
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
    if (!selectedRoom || files.length === 0) {
      return;
    }

    if (!isOnline) {
      toast.error("Photo uploads require a live connection right now");
      event.target.value = "";
      return;
    }

    setUploadingPhotos(true);
    let uploaded = 0;

    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl({
          roomInspectionId: selectedRoom._id,
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
          roomInspectionId: selectedRoom._id,
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

  async function handleRemovePhoto(photoId: Id<"photos">) {
    setRemovingPhotoId(photoId);
    try {
      await removePhoto({ photoId });
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove photo");
    } finally {
      setRemovingPhotoId(null);
    }
  }

  async function handleCompleteRoom() {
    if (!selectedRoom) {
      return;
    }

    setCompletingRoomId(selectedRoom._id);
    try {
      await completeRoom({ roomInspectionId: selectedRoom._id });
      toast.success("Room marked complete");
      const nextPendingRoom = inspection?.roomInspections.find(
        (room) => room._id !== selectedRoom._id && room.status !== "COMPLETED"
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

  if (inspection === undefined) {
    return <p className="text-slate-600">Loading checklist...</p>;
  }

  if (!inspection) {
    return <p className="text-slate-600">Checklist not found.</p>;
  }

  const selectedRoomSummary =
    inspection.roomInspections.find((room) => room._id === selectedRoomId) ?? null;
  const roomTasksComplete =
    selectedRoom?.taskResults.every((task) => task.completed) ?? false;
  const roomHasEnoughPhotos =
    selectedRoom !== undefined && selectedRoom !== null
      ? selectedRoom.photos.length >= selectedRoom.requiredPhotoMin
      : false;
  const canCompleteSelectedRoom =
    inspection.status !== "COMPLETED" &&
    selectedRoom !== null &&
    selectedRoom !== undefined &&
    roomTasksComplete &&
    roomHasEnoughPhotos &&
    selectedRoom.status !== "COMPLETED";

  const hasNoRooms = inspection.roomInspections.length === 0;
  const nextPendingRoom = inspection.roomInspections.find((room) => room.status !== "COMPLETED");
  const roomsRemaining = totals.rooms - totals.completedRooms;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            {inspection.type}
          </p>
          <h1 className="text-2xl font-bold">{inspection.propertyName}</h1>
          <p className="text-sm text-slate-600">Status: {inspection.status}</p>
        </div>
        <div className="max-w-sm rounded-2xl border border-border bg-white p-3 text-sm text-slate-600">
          {isOnline ? "Live sync active" : "Offline detected. Field edits need live sync right now."}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Rooms" value={`${totals.completedRooms}/${totals.rooms}`} />
        <SummaryCard label="Tasks" value={`${totals.completedTasks}/${totals.totalTasks}`} />
        <SummaryCard label="Photos" value={String(totals.photos)} />
        <SummaryCard label="Selected Room" value={selectedRoomSummary?.roomName ?? "None"} />
      </section>

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
              {inspection.roomInspections.map((room) => (
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
            ) : selectedRoom === undefined ? (
              <p className="text-sm text-slate-500">Loading room details...</p>
            ) : !selectedRoom ? (
              <p className="text-sm text-slate-500">Room not found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedRoom.roomName}</h2>
                    <p className="text-sm text-slate-600">
                      {selectedRoom.taskResults.filter((task) => task.completed).length}/
                      {selectedRoom.taskResults.length} tasks complete |{" "}
                      {selectedRoom.photos.length}/{selectedRoom.requiredPhotoMin} required photos
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${roomStatusTone(
                      selectedRoom.status
                    )}`}
                  >
                    {selectedRoom.status}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className={`rounded-2xl border p-3 ${stepTone(roomTasksComplete)}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 1</p>
                    <p className="mt-1 font-semibold">Complete tasks</p>
                    <p className="mt-1 text-sm">
                      {selectedRoom.taskResults.filter((task) => task.completed).length}/
                      {selectedRoom.taskResults.length} complete
                    </p>
                  </div>
                  <div className={`rounded-2xl border p-3 ${stepTone(roomHasEnoughPhotos)}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 2</p>
                    <p className="mt-1 font-semibold">Upload proof photos</p>
                    <p className="mt-1 text-sm">
                      {selectedRoom.photos.length}/{selectedRoom.requiredPhotoMin} required
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl border p-3 ${stepTone(
                      selectedRoom.status === "COMPLETED"
                    )}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Step 3</p>
                    <p className="mt-1 font-semibold">Finish room</p>
                    <p className="mt-1 text-sm">
                      {selectedRoom.status === "COMPLETED"
                        ? "Room is complete"
                        : "Mark complete after tasks and photos"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 font-semibold">Step 1: Complete room tasks</h3>
                  <div className="space-y-2">
                    {selectedRoom.taskResults.map((task) => (
                      <label
                        key={task._id}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-slate-50 p-3"
                      >
                        <input
                          checked={task.completed}
                          disabled={inspection.status === "COMPLETED" || savingTaskId === task._id}
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
                    disabled={inspection.status === "COMPLETED"}
                    onChange={(event) => setRoomNotes(event.target.value)}
                    value={roomNotes}
                  />
                  <button
                    className="field-button secondary mt-3 px-4"
                    disabled={inspection.status === "COMPLETED" || savingNotes}
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
                        disabled={inspection.status === "COMPLETED" || uploadingPhotos}
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
                        disabled={inspection.status === "COMPLETED" || uploadingPhotos || !isOnline}
                        multiple
                        onChange={(event) => void handlePhotoUpload(event)}
                        type="file"
                      />
                    </label>
                  </div>

                  {selectedRoom.photos.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No photos uploaded yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedRoom.photos.map((photo) => (
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
                              Preview unavailable
                            </div>
                          )}
                          <div className="space-y-2 p-3">
                            <div>
                              <p className="text-sm font-semibold">{photo.fileName}</p>
                              <p className="text-xs text-slate-500">{photo.kind ?? "GENERAL"}</p>
                            </div>
                            <button
                              className="field-button secondary w-full px-3"
                              disabled={inspection.status === "COMPLETED" || removingPhotoId === photo._id}
                              onClick={() => void handleRemovePhoto(photo._id)}
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
                          Upload at least {selectedRoom.requiredPhotoMin} photo(s) for this room
                          before completing it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    className="field-button primary w-full px-5"
                    disabled={!canCompleteSelectedRoom || completingRoomId === selectedRoom._id}
                    onClick={() => void handleCompleteRoom()}
                    type="button"
                  >
                    {completingRoomId === selectedRoom._id
                      ? "Completing Room..."
                      : selectedRoom.status === "COMPLETED"
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
              disabled={inspection.status === "COMPLETED"}
              onChange={(event) => setInspectionNotes(event.target.value)}
              placeholder="Add overall inspection notes or shift summary"
              value={inspectionNotes}
            />
            <button
              className="field-button primary mt-3 w-full px-5"
              disabled={inspection.status === "COMPLETED" || completingInspection}
              onClick={() => void handleCompleteInspection()}
              type="button"
            >
              {completingInspection
                ? "Completing Checklist..."
                : inspection.status === "COMPLETED"
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
