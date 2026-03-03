import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import {
  ArrowLeft,
  CheckCircle,
  Camera,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import toast from "react-hot-toast";

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspectionId = id as Id<"inspections">;
  const inspection = useQuery(api.inspections.getById, { inspectionId });
  const completeInspection = useMutation(api.inspections.complete);

  const [completing, setCompleting] = useState(false);

  if (inspection === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (inspection === null) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">Inspection not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const rooms = inspection.roomInspections ?? [];
  const completedRooms = rooms.filter((r) => r.status === "COMPLETED").length;
  const totalTasks = rooms.reduce((acc, r) => acc + r.totalTasks, 0);
  const completedTasks = rooms.reduce((acc, r) => acc + r.completedTasks, 0);
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const allRoomsDone = completedRooms === rooms.length && rooms.length > 0;

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeInspection({ inspectionId });
      toast.success("Inspection completed!");
      navigate("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete inspection"
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1.5 text-muted hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{inspection.propertyName}</h1>
          <p className="text-sm text-muted">
            Inspector: {inspection.inspectorName}
          </p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {/* Overall progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-muted">
            {completedRooms}/{rooms.length} rooms
          </span>
        </div>
        <ProgressBar value={overallProgress} showLabel />
        <p className="mt-2 text-xs text-muted">
          {completedTasks}/{totalTasks} tasks completed
        </p>
      </Card>

      {/* Room list */}
      <div className="space-y-2">
        {rooms.map((room) => {
          const roomProgress =
            room.totalTasks > 0
              ? (room.completedTasks / room.totalTasks) * 100
              : 0;
          const isDone = room.status === "COMPLETED";

          return (
            <Link
              key={room._id}
              to={`/inspections/${inspectionId}/rooms/${room._id}`}
              className="block"
            >
              <Card
                className={`flex items-center gap-4 p-4 transition-all hover:shadow-md ${
                  isDone
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "hover:border-primary-300"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isDone
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-gray-100 text-muted"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <ClipboardCheck className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {room.roomName}
                    </p>
                    <span className="text-xs text-muted ml-2 shrink-0">
                      {room.completedTasks}/{room.totalTasks}
                    </span>
                  </div>
                  <ProgressBar value={roomProgress} size="sm" className="mt-2" />
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      {room.photoCount} photo{room.photoCount !== 1 && "s"}
                    </span>
                    <StatusBadge status={room.status} />
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted shrink-0" />
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Complete inspection button */}
      {inspection.status === "IN_PROGRESS" && (
        <div className="sticky bottom-20 lg:bottom-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleComplete}
            loading={completing}
            disabled={!allRoomsDone}
          >
            <CheckCircle className="h-5 w-5" />
            {allRoomsDone
              ? "Complete Inspection"
              : `${rooms.length - completedRooms} room${rooms.length - completedRooms !== 1 ? "s" : ""} remaining`}
          </Button>
        </div>
      )}
    </div>
  );
}
