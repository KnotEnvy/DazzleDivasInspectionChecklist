import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const DAY_MS = 24 * 60 * 60 * 1000;

type ScheduleJob = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  propertyName: string;
  propertyAddress: string;
  propertyServiceNotes?: string;
  scheduledStart: number;
  scheduledEnd: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
  jobType: "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeName?: string | null;
  notes?: string;
  checklistType: "CLEANING" | "INSPECTION" | null;
  canStartChecklist: boolean;
};

type JobDetail = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
  jobType: "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
  notes?: string;
  linkedInspectionId?: Id<"inspections">;
  checklistType: "CLEANING" | "INSPECTION" | null;
  property?: {
    name: string;
    address: string;
    timezone?: string;
    serviceNotes?: string;
  } | null;
};

function startOfWeekLocal(date: Date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  const day = clone.getDay();
  const mondayOffset = (day + 6) % 7;
  clone.setDate(clone.getDate() - mondayOffset);
  return clone;
}

function sameLocalDate(timestamp: number, date: Date) {
  const value = new Date(timestamp);
  return (
    value.getFullYear() === date.getFullYear() &&
    value.getMonth() === date.getMonth() &&
    value.getDate() === date.getDate()
  );
}

export function MySchedulePage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [startingChecklist, setStartingChecklist] = useState(false);
  const [scheduleAnchor] = useState(() => Date.now());
  const windowStart = useMemo(() => startOfWeekLocal(new Date(scheduleAnchor)), [scheduleAnchor]);
  const windowEnd = useMemo(() => {
    return new Date(windowStart.getTime() + 13 * DAY_MS + (23 * 60 + 59) * 60 * 1000);
  }, [windowStart]);

  const jobs = useQuery(api.jobs.listMyUpcoming, {
    from: windowStart.getTime(),
    to: windowEnd.getTime(),
  }) as ScheduleJob[] | undefined;

  const selectedJob = useQuery(
    api.jobs.getById,
    selectedJobId ? { jobId: selectedJobId } : "skip"
  ) as JobDetail | null | undefined;

  const createInspection = useMutation(api.inspections.create);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      return new Date(windowStart.getTime() + index * DAY_MS);
    });
  }, [windowStart]);

  const jobsByDay = useMemo(() => {
    return weekDays.map((day) =>
      (jobs ?? [])
        .filter((job) => sameLocalDate(job.scheduledStart, day))
        .sort((a, b) => a.scheduledStart - b.scheduledStart)
    );
  }, [jobs, weekDays]);

  async function handleStartChecklist() {
    if (!selectedJob) {
      return;
    }

    if (selectedJob.linkedInspectionId) {
      navigate(`/checklists/${selectedJob.linkedInspectionId}`);
      return;
    }

    if (!selectedJob.checklistType) {
      toast.error("This job type does not support checklist execution");
      return;
    }

    setStartingChecklist(true);
    try {
      const inspectionId = await createInspection({
        propertyId: selectedJob.propertyId,
        type: selectedJob.checklistType,
        jobId: selectedJob._id,
      });

      toast.success("Checklist started from job");
      navigate(`/checklists/${inspectionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checklist");
    } finally {
      setStartingChecklist(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-sm text-slate-600">
          Upcoming jobs for {user?.role ?? "your role"} with one-tap checklist start.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">Week View</h2>
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((day, index) => (
            <div key={day.toISOString()} className="rounded-xl border border-border bg-slate-50 p-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className="mb-2 text-sm font-semibold">{day.toLocaleDateString()}</p>
              <div className="space-y-2">
                {jobsByDay[index].length === 0 ? (
                  <p className="text-xs text-slate-500">No jobs</p>
                ) : (
                  jobsByDay[index].map((job) => (
                    <button
                      key={job._id}
                      className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                        selectedJobId === job._id
                          ? "border-brand-500 bg-brand-50"
                          : "border-border bg-white hover:border-brand-300"
                      }`}
                      onClick={() => setSelectedJobId(job._id)}
                      type="button"
                    >
                      <p className="font-semibold">
                        {new Date(job.scheduledStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {job.jobType}
                      </p>
                      <p className="text-slate-600">{job.propertyName}</p>
                      <p className="text-slate-500">{job.status}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Upcoming Jobs</h2>
          {jobs === undefined ? (
            <p className="text-sm text-slate-500">Loading schedule...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming jobs in this window.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job._id}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedJobId === job._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-white hover:border-brand-300"
                  }`}
                  onClick={() => setSelectedJobId(job._id)}
                  type="button"
                >
                  <p className="font-semibold">
                    {job.propertyName} | {job.jobType}
                  </p>
                  <p className="text-sm text-slate-600">
                    {new Date(job.scheduledStart).toLocaleString()} -{" "}
                    {new Date(job.scheduledEnd).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {job.status} | Priority: {job.priority ?? "MEDIUM"}
                    {job.assigneeName ? ` | Assignee: ${job.assigneeName}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Job Details</h2>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Select a job to view details.</p>
          ) : selectedJob === undefined ? (
            <p className="text-sm text-slate-500">Loading job details...</p>
          ) : !selectedJob ? (
            <p className="text-sm text-slate-500">Job not found.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-slate-50 p-3">
                <p className="font-semibold">{selectedJob.property?.name ?? "Unknown property"}</p>
                <p className="text-sm text-slate-600">
                  {selectedJob.property?.address ?? "No address"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedJob.jobType} | {selectedJob.status}
                </p>
              </div>

              {selectedJob.notes && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Job Notes</p>
                  <p className="text-sm text-slate-600">{selectedJob.notes}</p>
                </div>
              )}

              {selectedJob.property?.serviceNotes && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Property Service Notes</p>
                  <p className="text-sm text-slate-600">{selectedJob.property.serviceNotes}</p>
                </div>
              )}

              <button
                className="field-button primary w-full px-4"
                disabled={
                  startingChecklist ||
                  selectedJob.checklistType === null ||
                  selectedJob.status === "COMPLETED" ||
                  selectedJob.status === "CANCELLED"
                }
                onClick={() => void handleStartChecklist()}
                type="button"
              >
                {startingChecklist
                  ? "Starting..."
                  : selectedJob.linkedInspectionId
                    ? "Open Linked Checklist"
                    : "Start Checklist"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
