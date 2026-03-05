import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";

type InspectionRoom = {
  _id: string;
  roomName: string;
  status: string;
  completedTasks: number;
  totalTasks: number;
  photoCount: number;
};

type InspectionDetail = {
  _id: string;
  propertyName: string;
  type: string;
  status: "IN_PROGRESS" | "COMPLETED";
  roomInspections: InspectionRoom[];
};

export function InspectionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const inspectionId = params.inspectionId as Id<"inspections"> | undefined;

  const inspection = useQuery(
    api.inspections.getById,
    inspectionId ? { inspectionId } : "skip"
  ) as InspectionDetail | null | undefined;

  const completeInspection = useMutation(api.inspections.complete);

  if (!inspectionId) {
    return <p className="text-slate-600">Missing inspection id.</p>;
  }

  async function handleComplete() {
    if (!inspectionId) {
      return;
    }

    try {
      await completeInspection({ inspectionId });
      toast.success("Checklist marked as completed");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete");
    }
  }

  if (inspection === undefined) {
    return <p className="text-slate-600">Loading checklist...</p>;
  }

  if (!inspection) {
    return <p className="text-slate-600">Checklist not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            {inspection.type}
          </p>
          <h1 className="text-2xl font-bold">{inspection.propertyName}</h1>
          <p className="text-sm text-slate-600">Status: {inspection.status}</p>
        </div>

        <button
          className="field-button primary px-5"
          disabled={inspection.status === "COMPLETED"}
          onClick={() => void handleComplete()}
        >
          Complete Checklist
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {inspection.roomInspections.map((room) => (
          <div key={room._id} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{room.roomName}</h2>
              <span className="text-xs font-semibold text-slate-500">{room.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Tasks: {room.completedTasks}/{room.totalTasks}
            </p>
            <p className="text-sm text-slate-600">Photos: {room.photoCount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
