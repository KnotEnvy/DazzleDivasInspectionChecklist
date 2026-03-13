import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InspectionRoomPanel } from "@/components/InspectionRoomPanel";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import {
  queueCompleteInspection,
  queueCompleteRoom,
  queueRemovePhoto,
  queueSetTaskCompleted,
  queueSetTaskIssue,
  queueUpdateRoomNotes,
  queueUploadPhoto,
  removeQueuedLocalPhoto,
  type PhotoKind,
} from "@/lib/offlineOutbox";
import { getNextHydratedDraft } from "@/lib/draftHydration";
import { applyInspectionOutboxOverlay } from "@/lib/offlineInspectionState";
import { roomStatusTone } from "@/lib/statusColors";

type RoomSummary = {
  _id: Id<"roomInspections">;
  roomName: string;
  status: "PENDING" | "COMPLETED";
  notes?: string;
  requiredPhotoMin: number;
  completedTasks: number;
  totalTasks: number;
  issueCount?: number;
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
    hasIssue?: boolean;
    issueNotes?: string;
  }>;
  photos: Array<{
    _id: Id<"photos">;
    fileName: string;
    mimeType: string;
    kind?: PhotoKind;
    url: string | null;
  }>;
};

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
  const setTaskIssue = useMutation(api.taskResults.setIssue);
  const updateRoomNotes = useMutation(api.roomInspections.updateNotes);
  const completeRoom = useMutation(api.roomInspections.complete);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.save);
  const removePhoto = useMutation(api.photos.remove);

  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [roomNotes, setRoomNotes] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [taskIssueDrafts, setTaskIssueDrafts] = useState<Record<string, string>>({});
  const [photoKind, setPhotoKind] = useState<PhotoKind>("AFTER");
  const [savingTaskId, setSavingTaskId] = useState<Id<"taskResults"> | null>(null);
  const [savingIssueTaskId, setSavingIssueTaskId] = useState<Id<"taskResults"> | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<Id<"photos"> | null>(null);
  const [completingRoomId, setCompletingRoomId] = useState<Id<"roomInspections"> | null>(null);
  const [completingInspection, setCompletingInspection] = useState(false);
  const lastHydratedRoomNotes = useRef("");
  const lastHydratedRoomId = useRef<string | null>(null);
  const lastHydratedInspectionNotes = useRef("");
  const lastHydratedInspectionId = useRef<string | null>(null);

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
      issues: rooms.reduce((sum, room) => sum + (room.issueCount ?? 0), 0),
      photos: rooms.reduce((sum, room) => sum + room.photoCount, 0),
    };
  }, [inspectionView]);

  useEffect(() => {
    if (!inspectionView || inspectionView.roomInspections.length === 0) {
      setSelectedRoomId(null);
      return;
    }

    if (
      selectedRoomId &&
      !inspectionView.roomInspections.some((room) => room._id === selectedRoomId)
    ) {
      setSelectedRoomId(inspectionView.roomInspections[0]._id);
    }
  }, [inspectionView, selectedRoomId]);

  useEffect(() => {
    setConfirmAction(null);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomView) {
      setRoomNotes("");
      lastHydratedRoomNotes.current = "";
      lastHydratedRoomId.current = null;
      return;
    }

    const nextSourceDraft = selectedRoomView.notes ?? "";
    const nextDraft = getNextHydratedDraft({
      currentDraft: roomNotes,
      lastHydratedDraft: lastHydratedRoomNotes.current,
      nextSourceDraft,
      sourceKeyChanged: lastHydratedRoomId.current !== selectedRoomView._id,
    });

    setRoomNotes(nextDraft);
    lastHydratedRoomNotes.current = nextSourceDraft;
    lastHydratedRoomId.current = selectedRoomView._id;
  }, [roomNotes, selectedRoomView?._id, selectedRoomView?.notes]);

  useEffect(() => {
    if (!selectedRoomView) {
      setTaskIssueDrafts({});
      return;
    }

    setTaskIssueDrafts(
      Object.fromEntries(
        selectedRoomView.taskResults.map((task) => [task._id, task.issueNotes ?? ""])
      )
    );
  }, [selectedRoomView]);

  useEffect(() => {
    if (!inspectionView) {
      setInspectionNotes("");
      lastHydratedInspectionNotes.current = "";
      lastHydratedInspectionId.current = null;
      return;
    }

    const nextSourceDraft = inspectionView.notes ?? "";
    const nextDraft = getNextHydratedDraft({
      currentDraft: inspectionNotes,
      lastHydratedDraft: lastHydratedInspectionNotes.current,
      nextSourceDraft,
      sourceKeyChanged: lastHydratedInspectionId.current !== inspectionView._id,
    });

    setInspectionNotes(nextDraft);
    lastHydratedInspectionNotes.current = nextSourceDraft;
    lastHydratedInspectionId.current = inspectionView._id;
  }, [inspectionNotes, inspectionView?._id, inspectionView?.notes]);

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

  async function handleTaskIssueSave(taskResultId: Id<"taskResults">, hasIssue: boolean) {
    setSavingIssueTaskId(taskResultId);

    try {
      if (!inspectionId || !selectedRoomView) {
        return;
      }

      const task = selectedRoomView.taskResults.find((candidate) => candidate._id === taskResultId);
      const issueNotes = hasIssue ? taskIssueDrafts[taskResultId] ?? "" : "";

      if (!isOnline) {
        await queueSetTaskIssue({
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          taskResultId,
          hasIssue,
          issueNotes,
          previousHasIssue: task?.hasIssue,
        });
        toast.success(hasIssue ? "Task issue queued for sync" : "Issue clear queued for sync");
        return;
      }

      await setTaskIssue({
        taskResultId,
        hasIssue,
        issueNotes,
      });
      toast.success(hasIssue ? "Task issue saved" : "Task issue cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save task issue");
    } finally {
      setSavingIssueTaskId(null);
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
        requestAnimationFrame(() =>
          document.getElementById(`room-${nextPendingRoom._id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        );
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

    if (roomsRemaining > 0) {
      toast.error(
        `Complete the remaining ${roomsRemaining} room${roomsRemaining === 1 ? "" : "s"} before finishing the checklist`
      );
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
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-2/3 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    );
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
  const canCompleteInspection =
    inspectionView.status !== "COMPLETED" && !hasNoRooms && roomsRemaining === 0;
  const showChecklistSyncStatus = !isOnline || inspectionQueueItems.length > 0;

  return (
    <div className="animate-fade-in space-y-5">
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

      <section className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="Rooms" value={`${totals.completedRooms}/${totals.rooms}`} />
        <SummaryCard label="Tasks" value={`${totals.completedTasks}/${totals.totalTasks}`} />
        <SummaryCard label="Issues" value={String(totals.issues)} />
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

      <section className="space-y-4">
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Rooms</h2>
            <p className="text-sm text-slate-600">
              Select a room to open its tasks, photos, and notes. Selecting a different room closes the
              current one.
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
                Admins can fix this in{" "}
                <Link className="font-semibold underline" to="/admin/templates">
                  Checklist Templates
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {inspectionView.roomInspections.map((room) => {
                const isOpen = selectedRoomId === room._id;

                return (
                  <div
                    key={room._id}
                    id={`room-${room._id}`}
                    className={`overflow-hidden rounded-2xl border transition ${
                      isOpen ? "border-brand-500 bg-brand-50" : "border-border bg-slate-50"
                    }`}
                  >
                    <button
                      aria-expanded={isOpen}
                      className={`w-full p-3 text-left transition ${isOpen ? "" : "hover:bg-white"}`}
                      onClick={() => setSelectedRoomId((current) => (current === room._id ? null : room._id))}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{room.roomName}</p>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${room.totalTasks > 0 ? (room.completedTasks / room.totalTasks) * 100 : 0}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Tasks {room.completedTasks}/{room.totalTasks} | Photos {room.photoCount}/
                            {room.requiredPhotoMin}
                          </p>
                          {(room.issueCount ?? 0) > 0 ? (
                            <p className="mt-1 text-xs text-rose-700">
                              {room.issueCount} issue{room.issueCount === 1 ? "" : "s"} flagged
                            </p>
                          ) : null}
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

                    {isOpen ? (
                      <div className="border-t border-brand-100 bg-white p-4">
                        <InspectionRoomPanel
                          canCompleteRoom={canCompleteSelectedRoom}
                          completingRoomId={completingRoomId}
                          confirmAction={confirmAction}
                          inspectionStatus={inspectionView.status}
                          onCompleteRoom={handleCompleteRoom}
                          onPhotoUpload={handlePhotoUpload}
                          onRemovePhoto={handleRemovePhoto}
                          onSaveNotes={handleSaveNotes}
                          onTaskIssueSave={handleTaskIssueSave}
                          onTaskToggle={handleTaskToggle}
                          photoKind={photoKind}
                          removingPhotoId={removingPhotoId}
                          room={selectedRoomView}
                          roomHasEnoughPhotos={roomHasEnoughPhotos}
                          roomNotes={roomNotes}
                          roomTasksComplete={roomTasksComplete}
                          savingIssueTaskId={savingIssueTaskId}
                          savingNotes={savingNotes}
                          savingTaskId={savingTaskId}
                          setConfirmAction={setConfirmAction}
                          setPhotoKind={setPhotoKind}
                          setRoomNotes={setRoomNotes}
                          setTaskIssueDrafts={setTaskIssueDrafts}
                          taskIssueDrafts={taskIssueDrafts}
                          uploadingPhotos={uploadingPhotos}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {!selectedRoomId && !hasNoRooms ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-slate-500">
            Select a room to open its checklist steps.
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">Finalize Checklist</h2>
              <p className="text-sm text-slate-600">
                Complete the final checklist only after every room is marked complete.
              </p>
            </div>
            {roomsRemaining > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Complete the remaining {roomsRemaining} room{roomsRemaining === 1 ? "" : "s"} before
                finishing the checklist.
              </div>
            ) : null}
            <textarea
              className="input min-h-28"
              disabled={inspectionView.status === "COMPLETED"}
              onChange={(event) => setInspectionNotes(event.target.value)}
              placeholder="Add overall inspection notes or shift summary"
              value={inspectionNotes}
            />
            {confirmAction === "completeInspection" ? (
              <div className="animate-slide-up mt-3 flex gap-2">
                <button
                  className="field-button danger flex-1 px-4"
                  disabled={!canCompleteInspection || completingInspection}
                  onClick={() => { setConfirmAction(null); void handleCompleteInspection(); }}
                  type="button"
                >
                  {completingInspection ? "Completing..." : "Complete Checklist"}
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
                className="field-button primary mt-3 w-full px-5"
                disabled={!canCompleteInspection || completingInspection}
                onClick={() => setConfirmAction("completeInspection")}
                type="button"
              >
                {completingInspection
                  ? "Completing Checklist..."
                  : inspectionView.status === "COMPLETED"
                    ? "Checklist Completed"
                    : "Complete Checklist"}
              </button>
            )}
          </div>
        </section>

        {showChecklistSyncStatus ? (
          <OfflineQueuePanel
            description="Checklist actions, room notes, room completion, and photo uploads queue locally and replay when connection returns."
            items={inspectionQueueItems}
            maxItems={4}
            title="Checklist Sync Status"
          />
        ) : null}
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
