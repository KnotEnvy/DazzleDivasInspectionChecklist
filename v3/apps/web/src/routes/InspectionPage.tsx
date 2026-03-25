import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CompletedInspectionReview } from "@/components/CompletedInspectionReview";
import { InspectionRoomPanel } from "@/components/InspectionRoomPanel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { useOfflineSync } from "@/app/OfflineSyncProvider";
import {
  getOutboxItems,
  queueCompleteInspection,
  queueCompleteRoom,
  queueRemovePhoto,
  queueSetTaskCompleted,
  queueSetTaskIssue,
  queueUpdateRoomNotes,
  queueUploadPhoto,
  queueUploadPhotos,
  removeQueuedLocalPhoto,
  type PhotoKind,
  type UploadPhotoPayload,
} from "@/lib/offlineOutbox";
import { getNextHydratedDraft } from "@/lib/draftHydration";
import { applyInspectionOutboxOverlay } from "@/lib/offlineInspectionState";
import { classifyReplayFailureStatus } from "@/lib/offlineReplay";
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

type CompletedReview = {
  property_name: string;
  property_address: string;
  checklist_type: "CLEANING" | "INSPECTION";
  assignee_name?: string;
  inspection_date: string;
  status: "COMPLETED";
  notes: string | null;
  issue_count: number;
  photo_count: number;
  rooms: Array<{
    room_inspection_id: Id<"roomInspections">;
    room_name: string;
    status: "PENDING" | "COMPLETED";
    notes: string | null;
    required_photo_min: number;
    issue_count: number;
    photo_count: number;
    tasks: Array<{
      description: string;
      completed: boolean;
      has_issue: boolean;
      issue_notes: string | null;
    }>;
    photos: Array<{
      photo_id: Id<"photos">;
      room_inspection_id: Id<"roomInspections">;
      room_name: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      kind: PhotoKind | null;
      url: string | null;
      captured_at: string;
      export_file_name: string;
    }>;
  }>;
};

type PendingDirectPhotoUpload = {
  roomInspectionId: string;
  promise: Promise<void>;
};

const MAX_DIRECT_PHOTO_UPLOADS = 2;

function createClientUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `direct-upload:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function InspectionPage() {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const isOnline = useNetworkStatus();
  const params = useParams();
  const inspectionId = params.inspectionId as Id<"inspections"> | undefined;

  const inspection = useQuery(
    api.inspections.getById,
    inspectionId ? { inspectionId } : "skip"
  ) as InspectionDetail | null | undefined;
  const { items: outboxItems } = useOutboxItems();
  const { flushNow } = useOfflineSync();

  const [selectedRoomId, setSelectedRoomId] = useState<Id<"roomInspections"> | null>(null);
  const isCompletedAdminReview = isAdmin && inspection?.status === "COMPLETED";
  const selectedRoom = useQuery(
    api.roomInspections.getById,
    !isCompletedAdminReview && selectedRoomId ? { roomInspectionId: selectedRoomId } : "skip"
  ) as RoomDetail | null | undefined;
  const completedReview = useQuery(
    api.inspections.getCompletedReview,
    inspectionId && isCompletedAdminReview ? { inspectionId } : "skip"
  ) as CompletedReview | null | undefined;

  const completeInspection = useMutation(api.inspections.complete);
  const setTaskCompleted = useMutation(api.taskResults.setCompleted);
  const setTaskIssue = useMutation(api.taskResults.setIssue);
  const updateRoomNotes = useMutation(api.roomInspections.updateNotes);
  const completeRoom = useMutation(api.roomInspections.complete);
  const removePhoto = useMutation(api.photos.remove);
  const generatePhotoUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.save);

  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [roomNotes, setRoomNotes] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [taskIssueDrafts, setTaskIssueDrafts] = useState<Record<string, string>>({});
  const [photoKind, setPhotoKind] = useState<PhotoKind>("AFTER");
  const [savingTaskId, setSavingTaskId] = useState<Id<"taskResults"> | null>(null);
  const [savingIssueTaskId, setSavingIssueTaskId] = useState<Id<"taskResults"> | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<Id<"photos"> | null>(null);
  const [completingRoomId, setCompletingRoomId] = useState<Id<"roomInspections"> | null>(null);
  const [completingInspection, setCompletingInspection] = useState(false);
  const lastHydratedRoomNotes = useRef("");
  const lastHydratedRoomId = useRef<string | null>(null);
  const lastHydratedInspectionNotes = useRef("");
  const lastHydratedInspectionId = useRef<string | null>(null);
  const [pendingDirectPhotoCountByRoom, setPendingDirectPhotoCountByRoom] = useState<
    Record<string, number>
  >({});
  const directPhotoUploadsRef = useRef<Map<string, PendingDirectPhotoUpload>>(new Map());

  const inspectionOverlay = useMemo(
    () => applyInspectionOutboxOverlay(inspection, selectedRoom, outboxItems),
    [inspection, outboxItems, selectedRoom]
  );
  const baseInspectionView = inspectionOverlay.inspection;
  const selectedRoomView = inspectionOverlay.selectedRoom;
  const selectedRoomPendingDirectPhotoCount = selectedRoomView
    ? pendingDirectPhotoCountByRoom[String(selectedRoomView._id)] ?? 0
    : 0;
  const inspectionView = useMemo(() => {
    if (!baseInspectionView) {
      return baseInspectionView;
    }

    return {
      ...baseInspectionView,
      roomInspections: baseInspectionView.roomInspections.map((room) => ({
        ...room,
        photoCount:
          room.photoCount + (pendingDirectPhotoCountByRoom[String(room._id)] ?? 0),
      })),
    };
  }, [baseInspectionView, pendingDirectPhotoCountByRoom]);
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

  const pendingQueuedPhotoCount = useMemo(
    () => outboxItems.filter((item) => item.type === "UPLOAD_PHOTO").length,
    [outboxItems]
  );

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

  function adjustPendingDirectPhotoCount(roomInspectionId: string, delta: number) {
    setPendingDirectPhotoCountByRoom((current) => {
      const existing = current[roomInspectionId] ?? 0;
      const nextCount = Math.max(0, existing + delta);

      if (nextCount === existing) {
        return current;
      }

      const next = { ...current };
      if (nextCount === 0) {
        delete next[roomInspectionId];
      } else {
        next[roomInspectionId] = nextCount;
      }
      return next;
    });
  }

  function getPendingDirectPhotoUploadPromises(roomInspectionId: string) {
    return [...directPhotoUploadsRef.current.values()]
      .filter((upload) => upload.roomInspectionId === roomInspectionId)
      .map((upload) => upload.promise);
  }

  function startDirectPhotoUpload(payload: Omit<UploadPhotoPayload, "localPhotoId">) {
    const uploadId = createClientUploadId();
    const roomInspectionKey = String(payload.roomInspectionId);

    adjustPendingDirectPhotoCount(roomInspectionKey, 1);

    const promise = (async () => {
      try {
        const uploadUrl = await generatePhotoUploadUrl({
          roomInspectionId: payload.roomInspectionId as Id<"roomInspections">,
        });

        if (typeof uploadUrl !== "string") {
          throw new Error("Upload URL was not returned for photo");
        }

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": payload.mimeType || "application/octet-stream",
          },
          body: payload.file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${payload.fileName}`);
        }

        const body = (await response.json()) as { storageId?: Id<"_storage"> };
        if (!body.storageId) {
          throw new Error(`Upload did not return a storage id for ${payload.fileName}`);
        }

        await savePhoto({
          storageId: body.storageId,
          roomInspectionId: payload.roomInspectionId as Id<"roomInspections">,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
          kind: payload.kind,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload photo";
        if (classifyReplayFailureStatus(message) !== "FAILED") {
          throw error;
        }

        await queueUploadPhoto(payload);
        toast(`Connection slowed down. Saved ${payload.fileName} locally for sync.`);
      } finally {
        directPhotoUploadsRef.current.delete(uploadId);
        adjustPendingDirectPhotoCount(roomInspectionKey, -1);
      }
    })().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    });

    directPhotoUploadsRef.current.set(uploadId, {
      roomInspectionId: roomInspectionKey,
      promise,
    });
  }

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

  async function handlePhotoFiles(files: File[]) {
    if (!inspectionId || !selectedRoomView || files.length === 0) {
      return;
    }

    try {
      const captureStartedAt = Date.now();
      const payloads = files.map((file, index) => {
        const mimeType = file.type || "application/octet-stream";
        const fallbackExtension = mimeType === "image/png" ? ".png" : ".jpg";
        const fileName = file.name?.trim() || `photo-${captureStartedAt}-${index + 1}${fallbackExtension}`;
        const blob = file.slice(0, file.size, mimeType);

        return {
          inspectionId,
          roomInspectionId: selectedRoomView._id,
          file: blob,
          fileName,
          fileSize: blob.size,
          mimeType,
          kind: photoKind,
        } satisfies Omit<UploadPhotoPayload, "localPhotoId">;
      });

      const shouldQueuePhotos =
        !isOnline ||
        pendingQueuedPhotoCount > 0 ||
        directPhotoUploadsRef.current.size + payloads.length > MAX_DIRECT_PHOTO_UPLOADS;

      if (shouldQueuePhotos) {
        await queueUploadPhotos(payloads);

        if (isOnline) {
          toast.success(
            `Saved ${files.length} photo${files.length === 1 ? "" : "s"} locally and queued background sync`
          );
        } else {
          toast.success(
            `Saved ${files.length} photo${files.length === 1 ? "" : "s"} for sync`
          );
        }
        return;
      }

      for (const payload of payloads) {
        startDirectPhotoUpload(payload);
      }

      toast.success(
        `Saving ${files.length} photo${files.length === 1 ? "" : "s"} in background`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save photo locally");
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await handlePhotoFiles(files);
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
        const roomInspectionKey = String(selectedRoomView._id);
        const pendingDirectUploads = getPendingDirectPhotoUploadPromises(roomInspectionKey);

        if (pendingDirectUploads.length > 0) {
          const syncingToastId = toast.loading(
            `Finishing ${pendingDirectUploads.length} background photo${pendingDirectUploads.length === 1 ? "" : "s"} before room completion`
          );

          try {
            await Promise.allSettled(pendingDirectUploads);
          } finally {
            toast.dismiss(syncingToastId);
          }
        }

        const queuedRoomPhotos = (await getOutboxItems()).filter(
          (item) =>
            item.type === "UPLOAD_PHOTO" &&
            item.payload.roomInspectionId === selectedRoomView._id
        );

        if (queuedRoomPhotos.length > 0) {
          const syncingToastId = toast.loading(
            `Syncing ${queuedRoomPhotos.length} queued photo${queuedRoomPhotos.length === 1 ? "" : "s"} before room completion`
          );

          try {
            await flushNow();
          } finally {
            toast.dismiss(syncingToastId);
          }

          const remainingRoomPhotoQueue = (await getOutboxItems()).filter(
            (item) =>
              item.type === "UPLOAD_PHOTO" &&
              item.payload.roomInspectionId === selectedRoomView._id
          );

          if (remainingRoomPhotoQueue.length > 0) {
            toast.error("Room photos are still syncing. Finish the queue before completing this room.");
            return;
          }
        }

        await completeRoom({ roomInspectionId: selectedRoomView._id });
        toast.success("Room marked complete");
      }

      const nextPendingRoom = inspectionView?.roomInspections.find(
        (room) => room._id !== selectedRoomView._id && room.status !== "COMPLETED"
      );
      if (nextPendingRoom) {
        setSelectedRoomId(null);
        requestAnimationFrame(() =>
          document.getElementById(`room-${nextPendingRoom._id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        );
      } else {
        setSelectedRoomId(null);
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

  if (isCompletedAdminReview) {
    if (completedReview === undefined) {
      return (
        <div className="space-y-4">
          <div className="skeleton h-6 w-2/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      );
    }

    if (!completedReview) {
      return <p className="text-slate-600">Completed review not found.</p>;
    }

    return (
      <div className="animate-fade-in space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              {inspectionView.type}
            </p>
            <h1 className="text-2xl font-bold">{inspectionView.propertyName}</h1>
            <p className="text-sm text-slate-600">
              Completed checklists stay read-only for admin review and photo saving.
            </p>
          </div>
          <Link className="field-button secondary px-4" to="/history">
            Back to History
          </Link>
        </div>

        <CompletedInspectionReview review={completedReview} />
      </div>
    );
  }

  const selectedRoomSummary =
    inspectionView.roomInspections.find((room) => room._id === selectedRoomId) ?? null;
  const roomTasksComplete =
    selectedRoomView?.taskResults.every((task) => task.completed) ?? false;
  const roomHasEnoughPhotos =
    selectedRoomView !== undefined && selectedRoomView !== null
      ? selectedRoomView.photos.length + selectedRoomPendingDirectPhotoCount >=
        selectedRoomView.requiredPhotoMin
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
  const showChecklistSyncStatus = !isOnline;

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
                          pendingDirectPhotoCount={selectedRoomPendingDirectPhotoCount}
                          photoKind={photoKind}
                          removingPhotoId={removingPhotoId}
                          room={selectedRoomView}
                          roomNotes={roomNotes}
                          savingIssueTaskId={savingIssueTaskId}
                          savingNotes={savingNotes}
                          savingTaskId={savingTaskId}
                          setConfirmAction={setConfirmAction}
                          setPhotoKind={setPhotoKind}
                          setRoomNotes={setRoomNotes}
                          setTaskIssueDrafts={setTaskIssueDrafts}
                          taskIssueDrafts={taskIssueDrafts}
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















