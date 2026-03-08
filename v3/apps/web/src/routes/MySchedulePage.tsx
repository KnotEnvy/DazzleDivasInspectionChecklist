import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import {
  queueCreateInspection,
  queueUpdateMyJobStatus,
} from "@/lib/offlineOutbox";
import { buildJobStatusOverlay } from "@/lib/offlineInspectionState";

const DAY_MS = 24 * 60 * 60 * 1000;

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type JobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
type IntakeSource = "EMAIL" | "TEXT" | "PHONE" | "MANUAL";
type WorkerEditableStatus = "IN_PROGRESS" | "BLOCKED";

type ScheduleJob = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  scheduledStart: number;
  scheduledEnd: number;
  assigneeId?: Id<"users">;
  linkedInspectionId?: Id<"inspections">;
  propertyName: string;
  propertyAddress: string;
  propertyServiceNotes?: string;
  status: JobStatus;
  jobType: JobType;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  intakeSource?: IntakeSource;
  clientLabel?: string;
  arrivalDeadline?: number;
  assigneeName?: string | null;
  notes?: string;
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

function statusTone(status: JobStatus) {
  switch (status) {
    case "SCHEDULED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "IN_PROGRESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCKED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "COMPLETED":
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
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
  const [startingChecklist, setStartingChecklist] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<WorkerEditableStatus | null>(null);
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
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Start or resume checklist work directly from your schedule. Job completion still comes
          from finishing the linked checklist.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Jobs In Window" value={summary.total} />
        <SummaryCard label="In Progress" value={summary.inProgress} />
        <SummaryCard label="Blocked" value={summary.blocked} />
        <SummaryCard label="Checklists Started" value={summary.readyToResume} />
      </section>

      <OfflineQueuePanel
        description="Worker status changes and checklist starts can queue locally and replay when the device reconnects."
        items={scheduleQueueItems}
        maxItems={4}
        title="Schedule Sync Status"
      />

      <section className="rounded-3xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Worker Focus
            </p>
            <h2 className="text-xl font-bold">
              {selectedListJob ? selectedListJob.propertyName : "No job selected"}
            </h2>
            <p className="text-sm text-slate-600">
              {selectedListJob
                ? `${selectedListJob.jobType} | ${formatJobWindow(selectedListJob)}`
                : `Your ${formatScheduleWindow(windowStart, windowEnd)} schedule is clear.`}
            </p>
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
          <p className="mt-4 text-sm text-slate-500">No jobs scheduled in this two-week window.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedListJob.propertyAddress}</p>
              <p className="mt-1 text-sm text-slate-600">
                Priority: {selectedListJob.priority ?? "MEDIUM"}
                {selectedListJob.assigneeName ? ` | Assigned to ${selectedListJob.assigneeName}` : ""}
              </p>
              {summarizeTurnoverIntake(selectedListJob) && (
                <p className="mt-1 text-sm text-slate-600">{summarizeTurnoverIntake(selectedListJob)}</p>
              )}
              {selectedListJob.notes && (
                <p className="mt-3 text-sm text-slate-600">{selectedListJob.notes}</p>
              )}
              {selectedListJob.propertyServiceNotes && (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {selectedListJob.propertyServiceNotes}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
              <button
                className="field-button primary w-full px-5"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="field-button secondary w-full px-4"
                  disabled={
                    statusControlsLocked ||
                    updatingStatus !== null ||
                    selectedJobEffectiveStatus === "IN_PROGRESS"
                  }
                  onClick={() => void handleStatusChange("IN_PROGRESS")}
                  type="button"
                >
                  {updatingStatus === "IN_PROGRESS" ? "Saving..." : "Mark In Progress"}
                </button>
                <button
                  className="field-button secondary w-full px-4"
                  disabled={
                    statusControlsLocked ||
                    updatingStatus !== null ||
                    selectedJobEffectiveStatus === "BLOCKED"
                  }
                  onClick={() => void handleStatusChange("BLOCKED")}
                  type="button"
                >
                  {updatingStatus === "BLOCKED" ? "Saving..." : "Mark Blocked"}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Use the checklist as the main work surface. Marking the checklist complete is what
              closes the job.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Upcoming Jobs</h2>
              <p className="text-sm text-slate-600">
                One tap opens the checklist. Use Focus Job for full property details.
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {upcomingJobs.length} jobs
            </span>
          </div>

          {jobs === undefined ? (
            <p className="text-sm text-slate-500">Loading schedule...</p>
          ) : upcomingJobs.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming jobs in this window.</p>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <div
                  key={job._id}
                  className={`rounded-2xl border p-4 transition ${
                    selectedJobId === job._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{job.propertyName}</p>
                      <p className="text-sm text-slate-600">{formatJobWindow(job)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.jobType} | Priority: {job.priority ?? "MEDIUM"}
                      </p>
                      {summarizeTurnoverIntake(job) && (
                        <p className="mt-1 text-xs text-slate-500">{summarizeTurnoverIntake(job)}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {(job.notes || job.propertyServiceNotes) && (
                    <div className="mt-3 space-y-2">
                      {job.notes && <p className="text-sm text-slate-600">{job.notes}</p>}
                      {job.propertyServiceNotes && (
                        <p className="text-xs text-amber-800">{job.propertyServiceNotes}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      className="field-button primary w-full px-4 sm:flex-1"
                      disabled={
                        startingChecklist ||
                        !job.assigneeId ||
                        job.checklistType === null ||
                        job.status === "COMPLETED" ||
                        job.status === "CANCELLED"
                      }
                      onClick={() => void handleOpenChecklist(job)}
                      type="button"
                    >
                      {outboxOverlay.queuedChecklistByJobId.has(job._id)
                        ? "Checklist Queued"
                        : checklistActionLabel(job)}
                    </button>
                    <button
                      className="field-button secondary w-full px-4 sm:flex-1"
                      onClick={() => setSelectedJobId(job._id)}
                      type="button"
                    >
                      Focus Job
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Job Details</h2>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Choose a job to review field details.</p>
          ) : selectedJob === undefined ? (
            <p className="text-sm text-slate-500">Loading job details...</p>
          ) : !selectedJobEffective ? (
            <p className="text-sm text-slate-500">Job not found.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{selectedJobEffective.property?.name ?? "Unknown property"}</p>
                    <p className="text-sm text-slate-600">
                      {selectedJobEffective.property?.address ?? "No address on file"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                      selectedJobEffective.status
                    )}`}
                  >
                    {selectedJobEffective.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {selectedJobEffective.jobType} | {formatJobWindow(selectedJobEffective)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Priority: {selectedJobEffective.priority ?? "MEDIUM"}
                  {selectedJobEffective.assignee ? ` | ${selectedJobEffective.assignee.name}` : ""}
                </p>
              </div>

              {selectedJobEffective.property?.serviceNotes && (
                <DetailBlock label="Service Notes" value={selectedJobEffective.property.serviceNotes} />
              )}

              {selectedJobEffective.property?.accessInstructions && (
                <DetailBlock
                  label="Access Instructions"
                  value={selectedJobEffective.property.accessInstructions}
                />
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

              {!selectedJobIsMine && user?.role !== "ADMIN" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Only the assigned worker can change this job&apos;s status from My Schedule.
                </div>
              )}

              <div className="rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Status Controls</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Workers can move jobs between in-progress and blocked here. Completion still comes
                  from the checklist flow.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    className="field-button secondary w-full px-4"
                    disabled={
                    statusControlsLocked ||
                    updatingStatus !== null ||
                    selectedJobEffectiveStatus === "IN_PROGRESS"
                  }
                  onClick={() => void handleStatusChange("IN_PROGRESS")}
                    type="button"
                  >
                    {updatingStatus === "IN_PROGRESS" ? "Saving..." : "Mark In Progress"}
                  </button>
                  <button
                    className="field-button secondary w-full px-4"
                    disabled={
                    statusControlsLocked ||
                    updatingStatus !== null ||
                    selectedJobEffectiveStatus === "BLOCKED"
                  }
                  onClick={() => void handleStatusChange("BLOCKED")}
                    type="button"
                  >
                    {updatingStatus === "BLOCKED" ? "Saving..." : "Mark Blocked"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>

      <section className="rounded-3xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-lg font-bold">This Week</h2>
          <p className="text-sm text-slate-600">
            Quick scan of the current week while your two-week list stays focused on action.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((day, index) => (
            <div key={day.toISOString()} className="rounded-2xl border border-border bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className="mb-3 text-sm font-semibold">{day.toLocaleDateString()}</p>
              <div className="space-y-2">
                {jobsByDay[index].length === 0 ? (
                  <p className="text-xs text-slate-500">No jobs</p>
                ) : (
                  jobsByDay[index].map((job) => (
                    <button
                      key={job._id}
                      className={`w-full rounded-2xl border p-2 text-left text-xs transition ${
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
                        })}
                      </p>
                      <p className="mt-1 text-slate-700">{job.propertyName}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{job.status}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
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
