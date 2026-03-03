import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { PhotoUploadArea } from "@/components/common/PhotoUploadArea";
import { PhotoGrid } from "@/components/common/PhotoGrid";
import { TaskChecklist } from "@/components/rooms/TaskChecklist";
import {
  ArrowLeft,
  CheckCircle,
  Camera,
  StickyNote,
} from "lucide-react";
import toast from "react-hot-toast";

export function RoomInspectionPage() {
  const { id: inspectionId, roomId } = useParams<{
    id: string;
    roomId: string;
  }>();
  const navigate = useNavigate();

  const roomInspectionId = roomId as Id<"roomInspections">;
  const inspId = inspectionId as Id<"inspections">;
  const roomInspection = useQuery(api.roomInspections.getById, {
    roomInspectionId,
  });
  const photos = useQuery(api.photos.listByRoomInspection, {
    roomInspectionId,
  });
  const updateNotes = useMutation(api.roomInspections.updateNotes);
  const completeRoom = useMutation(api.roomInspections.complete);

  const [notes, setNotes] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (roomInspection?.notes != null) {
      setNotes(roomInspection.notes);
    }
  }, [roomInspection?.notes]);

  if (roomInspection === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (roomInspection === null) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Room not found.</p>
      </div>
    );
  }

  const tasks = roomInspection.taskResults ?? [];
  const photoCount = photos?.length ?? 0;
  const completed = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
  const isDone = roomInspection.status === "COMPLETED";
  const canComplete = photoCount >= 2;

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await updateNotes({ roomInspectionId, notes });
      setNotesChanged(false);
      toast.success("Notes saved");
    } catch (err) {
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      if (notesChanged) {
        await updateNotes({ roomInspectionId, notes });
      }
      await completeRoom({ roomInspectionId });
      toast.success("Room completed!");
      navigate(`/inspections/${inspectionId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete room"
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/inspections/${inspectionId}`)}
          className="rounded-md p-1.5 text-muted hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{roomInspection.roomName}</h1>
        </div>
        <StatusBadge status={roomInspection.status} />
      </div>

      {/* Progress */}
      <ProgressBar value={progress} showLabel />

      {/* Task checklist */}
      <Card>
        <TaskChecklist tasks={tasks} disabled={isDone} />
      </Card>

      {/* Photos section */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Photos
          </h3>
          <span className="text-xs text-muted">
            {photoCount} photo{photoCount !== 1 && "s"}{" "}
            {!isDone && (
              <span className={photoCount < 2 ? "text-danger" : "text-success"}>
                (min 2 required)
              </span>
            )}
          </span>
        </div>

        {/* Photo grid */}
        <PhotoGrid roomInspectionId={roomInspectionId} disabled={isDone} />

        {/* Upload area */}
        {!isDone && (
          <div className={photoCount > 0 ? "mt-3" : ""}>
            <PhotoUploadArea
              roomInspectionId={roomInspectionId}
              inspectionId={inspId}
              disabled={isDone}
            />
          </div>
        )}

        {photoCount === 0 && isDone && (
          <p className="text-sm text-muted text-center py-4">
            No photos were taken for this room.
          </p>
        )}
      </Card>

      {/* Notes */}
      <Card>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <StickyNote className="h-4 w-4" />
          Notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesChanged(true);
          }}
          disabled={isDone}
          placeholder="Add any notes about this room..."
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
          rows={3}
        />
        {notesChanged && !isDone && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={handleSaveNotes} loading={savingNotes}>
              Save Notes
            </Button>
          </div>
        )}
      </Card>

      {/* Complete button */}
      {!isDone && (
        <div className="sticky bottom-20 lg:bottom-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleComplete}
            loading={completing}
            disabled={!canComplete}
          >
            <CheckCircle className="h-5 w-5" />
            {canComplete
              ? "Complete Room"
              : `Need ${2 - photoCount} more photo${2 - photoCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
