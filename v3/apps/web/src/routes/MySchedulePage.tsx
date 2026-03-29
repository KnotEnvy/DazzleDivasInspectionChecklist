import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { EmptyState } from "@/components/EmptyState";
import {
  queueCreateInspection,
  queueUpdateMyJobStatus,
} from "@/lib/offlineOutbox";
import { buildJobStatusOverlay } from "@/lib/offlineInspectionState";
import { statusTone } from "@/lib/statusColors";

const DAY_MS = 24 * 60 * 60 * 1000;

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type JobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
type IntakeSource = "EMAIL" | "TEXT" | "PHONE" | "MANUAL";
type WorkerEditableStatus = "IN_PROGRESS" | "BLOCKED";

type ScheduleJob = {
  _id: Id<"jobs">;
  _creationTime: number;
  propertyId: Id<"properties">;
  scheduledStart: number;
  scheduledEnd: number;
  assigneeId?: Id<"users">;
  linkedInspectionId?: Id<"inspections">;
  propertyName: string;
  propertyAddress: string;
  status: JobStatus;
  jobType: JobType;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeName?: string | null;
  checklistType: "CLEANING" | "INSPECTION" | null;
  canStartChecklist: boolean;
};

type JobDetail = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  assigneeId?: Id<"users">;
  scheduledStart: number;
  scheduledEnd: number;
  status: JobStatus;
  jobType: JobType;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  intakeSource?: IntakeSource;
  clientLabel?: string;
  arrivalDeadline?: number;
  notes?: string;
  linkedInspectionId?: Id<"inspections">;
  checklistType: "CLEANING" | "INSPECTION" | null;
  property?: {
    name: string;
    address: string;
    timezone?: string;
    serviceNotes?: string;
    accessInstructions?: string;
    entryMethod?: string;
  } | null;
  assignee?: {
    _id: Id<"users">;
    name: string;
    role: "ADMIN" | "CLEANER" | "INSPECTOR";
    isActive: boolean;
  } | null;
};

function startOfDayLocal(date: Date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
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

function formatJobWindow(job: Pick<ScheduleJob, "scheduledStart" | "scheduledEnd">) {
  return `${new Date(job.scheduledStart).toLocaleString()} - ${new Date(job.scheduledEnd).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )}`;
}

function formatScheduleWindow(start: Date, end: Date) {
  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function formatOptionalDateTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : null;
}

function summarizeTurnoverIntake(job: {
  intakeSource?: IntakeSource;
  clientLabel?: string;
  arrivalDeadline?: number;
}) {
  const parts: string[] = [];
  if (job.clientLabel) {
    parts.push(job.clientLabel);
  }
  if (job.intakeSource) {
    parts.push(job.intakeSource);
  }
  if (job.arrivalDeadline) {
    parts.push(`Arrival ${new Date(job.arrivalDeadline).toLocaleString()}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

function checklistActionLabel(job: Pick<ScheduleJob, "linkedInspectionId">) {
  return job.linkedInspectionId ? "Resume Checklist" : "Start Checklist";
}

function workerFocusRank(job: ScheduleJob, now: number) {
  if (job.linkedInspectionId && job.status === "IN_PROGRESS") {
    return 0;
  }

  if (job.status === "IN_PROGRESS") {
    return 1;
  }

  if (job.linkedInspectionId && job.status === "BLOCKED") {
    return 2;
  }

  if (job.status === "BLOCKED") {
    return 3;
  }

  if (job.linkedInspectionId) {
    return 4;
  }

  if (job.scheduledStart <= now) {
    return 5;
  }

  return 6;
}

export function MySchedulePage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isOnline = useNetworkStatus();
  const { items: outboxItems } = useOutboxItems({ includeResolved: true });
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [startingChecklist, setStartingChecklist] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<WorkerEditableStatus | null>(null);
  const [scheduleAnchor] = useState(() => Date.now());

  const windowStart = useMemo(() => startOfDayLocal(new Date(scheduleAnchor)), [scheduleAnchor]);
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
  const updateMyStatus = useMutation(api.jobs.updateMyStatus);
  const outboxOverlay = useMemo(() => buildJobStatusOverlay(outboxItems), [outboxItems]);
  const scheduleQueueItems = useMemo(
    () =>
      outboxItems.filter(
        (item) =>
          item.type === "UPDATE_MY_JOB_STATUS" ||
          (item.type === "CREATE_INSPECTION" && !!item.payload.jobId)
      ),
    [outboxItems]
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      return new Date(windowStart.getTime() + index * DAY_MS);
    });
  }, [windowStart]);

  const jobsByDay = useMemo(() => {
    return weekDays.map((day) =>
      (jobs ?? [])
        .map((job) => ({
          ...job,
          status: outboxOverlay.latestStatusByJobId.get(job._id) ?? job.status,
        }))
        .filter((job) => sameLocalDate(job.scheduledStart, day))
        .sort((left, right) => left.scheduledStart - right.scheduledStart)
    );
  }, [jobs, outboxOverlay.latestStatusByJobId, weekDays]);

  const prioritizedJob = useMemo(() => {
    const now = Date.now();
    return (jobs ?? [])
      .slice()
      .map((job) => ({
        ...job,
        status: outboxOverlay.latestStatusByJobId.get(job._id) ?? job.status,
      }))
      .sort((left, right) => {
        const rankDelta = workerFocusRank(left, now) - workerFocusRank(right, now);
        if (rankDelta !== 0) {
          return rankDelta;
        }

        return left.scheduledStart - right.scheduledStart;
      })[0] ?? null;
  }, [jobs, outboxOverlay.latestStatusByJobId]);

  const upcomingJobs = useMemo(() => {
    return (jobs ?? [])
      .map((job) => ({
        ...job,
        status: outboxOverlay.latestStatusByJobId.get(job._id) ?? job.status,
      }))
      .sort((left, right) => left.scheduledStart - right.scheduledStart);
  }, [jobs, outboxOverlay.latestStatusByJobId]);

  const summary = useMemo(() => {
    const activeJobs = (jobs ?? []).map((job) => ({
      ...job,
      status: outboxOverlay.latestStatusByJobId.get(job._id) ?? job.status,
    }));
    return {
      total: activeJobs.length,
      inProgress: activeJobs.filter((job) => job.status === "IN_PROGRESS").length,
      blocked: activeJobs.filter((job) => job.status === "BLOCKED").length,
      readyToResume: activeJobs.filter((job) => job.linkedInspectionId).length,
    };
  }, [jobs, outboxOverlay.latestStatusByJobId]);

  useEffect(() => {
    if (!jobs || jobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !jobs.some((job) => job._id === selectedJobId)) {
      setSelectedJobId(prioritizedJob?._id ?? jobs[0]._id);
    }
  }, [jobs, prioritizedJob, selectedJobId]);

  async function handleOpenChecklist(
    job: Pick<
      ScheduleJob,
      "_id" | "propertyId" | "assigneeId" | "linkedInspectionId" | "checklistType"
    >
  ) {
    if (job.linkedInspectionId) {
      navigate(`/checklists/${job.linkedInspectionId}`);
      return;
    }

    if (!job.checklistType) {
      toast.error("This job type does not support checklist execution");
      return;
    }

    if (!job.assigneeId) {
      toast.error("This job must be assigned before a checklist can be started");
      return;
    }

    if (!isOnline) {
      await queueCreateInspection({
        propertyId: job.propertyId,
        type: job.checklistType,
        jobId: job._id,
      });
      toast.success("Checklist start queued for sync");
      return;
    }

    setStartingChecklist(true);
    try {
      const inspectionId = await createInspection({
        propertyId: job.propertyId,
        type: job.checklistType,
        jobId: job._id,
      });

      toast.success("Checklist opened from your schedule");
      navigate(`/checklists/${inspectionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open checklist");
    } finally {
      setStartingChecklist(false);
    }
  }

  async function handleStatusChange(status: WorkerEditableStatus) {
    if (!selectedJob) {
      return;
    }

    setUpdatingStatus(status);
    try {
      if (!isOnline) {
        await queueUpdateMyJobStatus({
          jobId: selectedJob._id,
          status,
        });
        toast.success(status === "IN_PROGRESS" ? "Status queued: in progress" : "Status queued: blocked");
        return;
      }

      await updateMyStatus({
        jobId: selectedJob._id,
        status,
      });
      toast.success(status === "IN_PROGRESS" ? "Job marked in progress" : "Job marked blocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update job status");
    } finally {
      setUpdatingStatus(null);
    }
  }

  const selectedListJob = upcomingJobs.find((job) => job._id === selectedJobId) ?? prioritizedJob;
  const selectedJobEffectiveStatus =
    (selectedJob ? outboxOverlay.latestStatusByJobId.get(selectedJob._id) : undefined) ??
    selectedJob?.status;
  const selectedJobEffective = selectedJob
    ? {
        ...selectedJob,
        status: selectedJobEffectiveStatus ?? selectedJob.status,
      }
    : selectedJob;
  const selectedJobIsMine =
    !!selectedJob?.assigneeId && !!user?._id && selectedJob.assigneeId === user._id;
  const statusControlsLocked =
    !selectedJob ||
    !selectedJobIsMine ||
    selectedJobEffectiveStatus === "COMPLETED" ||
    selectedJobEffectiveStatus === "CANCELLED";

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{summary.total} jobs</span>
          {summary.inProgress > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{summary.inProgress} active</span>
          )}
          {summary.blocked > 0 && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{summary.blocked} blocked</span>
          )}
        </div>
      </div>

      {/* ── Weekly grid — primary nav on mobile ── */}
      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-600">Next 7 Days</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-7 md:gap-3 md:overflow-visible md:pb-0">
          {weekDays.map((day, index) => {
            const isToday = sameLocalDate(Date.now(), day);
            return (
              <div
                key={day.toISOString()}
                className={`min-w-[120px] flex-shrink-0 rounded-xl border p-2 md:min-w-0 md:flex-shrink ${
                  isToday ? "border-brand-500 border-t-2 bg-brand-50/40" : "border-border bg-slate-50"
                }`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${isToday ? "text-brand-700" : "text-slate-500"}`}>
                  {isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="text-xs font-semibold">
                  {day.toLocaleDateString(undefined, { weekday: isToday ? "short" : undefined, month: "short", day: "numeric" })}
                </p>
                <div className="mt-1.5 space-y-1">
                  {jobsByDay[index].length === 0 ? (
                    <p className="text-[11px] text-slate-400">&mdash;</p>
                  ) : (
                    jobsByDay[index].map((job) => (
                      <button
                        key={job._id}
                        aria-label={`Select ${job.propertyName} job`}
                        className={`w-full rounded-lg border px-1.5 py-1 text-left text-[11px] transition ${
                          selectedJobId === job._id
                            ? "border-brand-500 bg-brand-100"
                            : "border-border bg-white hover:border-brand-300"
                        }`}
                        onClick={() => setSelectedJobId(job._id)}
                        type="button"
                      >
                        <span className="font-semibold">
                          {new Date(job.scheduledStart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="ml-1 text-slate-600">{job.propertyName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Selected job detail (Worker Focus) ── */}
      <section className="rounded-2xl border border-border border-l-4 border-l-brand-600 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">
              {selectedListJob ? "Current Job" : "Worker Focus"}
            </p>
            <h2 className="text-lg font-bold lg:text-xl">
              {selectedListJob ? selectedListJob.propertyName : "No job selected"}
            </h2>
            {selectedListJob && (
              <p className="text-sm text-slate-600">
                {selectedListJob.jobType} | {formatJobWindow(selectedListJob)}
              </p>
            )}
          </div>
          {selectedListJob && (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                selectedListJob.status
              )}`}
            >
              {selectedListJob.status}
            </span>
          )}
        </div>

        {!selectedListJob ? (
          <p className="mt-3 text-sm text-slate-500">
            {jobs === undefined
              ? "Loading schedule..."
              : `Your ${formatScheduleWindow(windowStart, windowEnd)} window is clear.`}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {selectedJobEffective?.property?.address ?? selectedListJob.propertyAddress}
              </p>
              <p className="mt-1 text-slate-600">
                Priority: {selectedJobEffective?.priority ?? selectedListJob.priority ?? "MEDIUM"}
                {(selectedJobEffective?.assignee?.name ?? selectedListJob.assigneeName)
                  ? ` | ${selectedJobEffective?.assignee?.name ?? selectedListJob.assigneeName}`
                  : ""}
              </p>
              {selectedJobEffective?.notes && (
                <p className="mt-2 text-slate-600">{selectedJobEffective.notes}</p>
              )}
              {selectedJobEffective?.property?.serviceNotes && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {selectedJobEffective.property.serviceNotes}
                </p>
              )}
            </div>

            {/* Primary CTA + status controls — always visible */}
            <button
              className="field-button go w-full min-h-[52px] px-5"
              disabled={
                startingChecklist ||
                !selectedListJob.assigneeId ||
                selectedListJob.checklistType === null ||
                selectedListJob.status === "COMPLETED" ||
                selectedListJob.status === "CANCELLED"
              }
              onClick={() => void handleOpenChecklist(selectedListJob)}
              type="button"
            >
              {startingChecklist
                ? "Opening Checklist..."
                : outboxOverlay.queuedChecklistByJobId.has(selectedListJob._id)
                  ? "Checklist Queued"
                  : checklistActionLabel(selectedListJob)}
            </button>
            <div className="grid gap-2 grid-cols-2">
              <button
                className="field-button secondary w-full px-3"
                disabled={
                  statusControlsLocked ||
                  updatingStatus !== null ||
                  selectedJobEffectiveStatus === "IN_PROGRESS"
                }
                onClick={() => void handleStatusChange("IN_PROGRESS")}
                type="button"
              >
                {updatingStatus === "IN_PROGRESS" ? "Saving..." : "In Progress"}
              </button>
              <button
                className="field-button secondary w-full px-3"
                disabled={
                  statusControlsLocked ||
                  updatingStatus !== null ||
                  selectedJobEffectiveStatus === "BLOCKED"
                }
                onClick={() => void handleStatusChange("BLOCKED")}
                type="button"
              >
                {updatingStatus === "BLOCKED" ? "Saving..." : "Blocked"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Upcoming jobs — accordion, next job shown, rest collapsed ── */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        {jobs === undefined ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-14 rounded-xl" />
            <div className="skeleton h-14 rounded-xl" />
          </div>
        ) : upcomingJobs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              heading="No jobs in this window"
              description="Check back when dispatch assigns new work."
            />
          </div>
        ) : (
          <>
            {/* Next job preview (always visible) */}
            {upcomingJobs.filter((job) => job._id !== selectedJobId).length > 0 && (
              <div className="p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Up Next</p>
                {(() => {
                  const nextJob = upcomingJobs.find((job) => job._id !== selectedJobId) ?? upcomingJobs[0];
                  return (
                    <button
                      key={nextJob._id}
                      aria-label={`Focus on ${nextJob.propertyName}`}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-slate-50 p-3 text-left transition hover:border-brand-300"
                      onClick={() => setSelectedJobId(nextJob._id)}
                      type="button"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{nextJob.propertyName}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(nextJob.scheduledStart).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          {new Date(nextJob.scheduledStart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" | "}
                          {nextJob.jobType}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                          nextJob.status
                        )}`}
                      >
                        {nextJob.status}
                      </span>
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Expand toggle */}
            {upcomingJobs.length > 1 && (
              <>
                <button
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                  onClick={() => setShowAllJobs(!showAllJobs)}
                  type="button"
                >
                  {showAllJobs ? (
                    <>Hide full list <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Show all {upcomingJobs.length} jobs <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>

                {showAllJobs && (
                  <div className="space-y-1.5 border-t border-border p-3">
                    {upcomingJobs.map((job) => (
                      <button
                        key={job._id}
                        aria-label={`Focus on ${job.propertyName}`}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          selectedJobId === job._id
                            ? "border-brand-500 bg-brand-50"
                            : "border-border bg-slate-50 hover:border-brand-300"
                        }`}
                        onClick={() => setSelectedJobId(job._id)}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{job.propertyName}</p>
                          <p className="text-xs text-slate-600">
                            {new Date(job.scheduledStart).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(job.scheduledStart).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" | "}
                            {job.jobType}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* ── Job detail — desktop only, extra context for larger screens ── */}
      <aside className="hidden rounded-2xl border border-border bg-white p-4 shadow-sm xl:block">
        <h2 className="mb-3 text-sm font-bold text-slate-600">Job Details</h2>
        {!selectedJobId ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            heading="Select a job to see details"
            description="Pick a job from the list or weekly grid."
          />
        ) : selectedJob === undefined ? (
          <div className="space-y-3">
            <div className="skeleton h-6 w-2/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-20 rounded-xl" />
          </div>
        ) : !selectedJobEffective ? (
          <p className="text-sm text-slate-500">Job not found.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{selectedJobEffective.property?.name ?? "Unknown property"}</p>
                  <p className="text-slate-600">
                    {selectedJobEffective.property?.address ?? "No address on file"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                    selectedJobEffective.status
                  )}`}
                >
                  {selectedJobEffective.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {selectedJobEffective.jobType} | Priority: {selectedJobEffective.priority ?? "MEDIUM"}
                {selectedJobEffective.assignee ? ` | ${selectedJobEffective.assignee.name}` : ""}
              </p>
            </div>

            {selectedJobEffective.property?.serviceNotes && (
              <DetailBlock label="Service Notes" value={selectedJobEffective.property.serviceNotes} />
            )}
            {selectedJobEffective.property?.accessInstructions && (
              <DetailBlock label="Access Instructions" value={selectedJobEffective.property.accessInstructions} />
            )}
            {selectedJobEffective.property?.entryMethod && (
              <DetailBlock label="Entry Method" value={selectedJobEffective.property.entryMethod} />
            )}
            {selectedJobEffective.intakeSource && (
              <DetailBlock label="Turnover Source" value={selectedJobEffective.intakeSource} />
            )}
            {selectedJobEffective.clientLabel && (
              <DetailBlock label="Client / Account" value={selectedJobEffective.clientLabel} />
            )}
            {selectedJobEffective.arrivalDeadline && (
              <DetailBlock
                label="Arrival Deadline"
                value={formatOptionalDateTime(selectedJobEffective.arrivalDeadline) ?? ""}
              />
            )}
            {selectedJobEffective.notes && <DetailBlock label="Job Notes" value={selectedJobEffective.notes} />}
          </div>
        )}
      </aside>

      {/* ── Offline outbox — only visible when offline ── */}
      {!isOnline && (
        <OfflineQueuePanel
          description="Status changes and checklist starts queue locally until connection returns."
          items={scheduleQueueItems}
          maxItems={4}
          title="Offline Queue"
        />
      )}

    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-sm text-slate-600">{value}</p>
    </div>
  );
}
