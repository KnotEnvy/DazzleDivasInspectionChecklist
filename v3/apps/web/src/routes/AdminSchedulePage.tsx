import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type JobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";

type DispatchJob = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  propertyName: string;
  propertyAddress: string;
  propertyTimezone: string;
  propertyServiceNotes: string;
  propertyIsActive: boolean;
  propertyIsArchived: boolean;
  scheduledStart: number;
  scheduledEnd: number;
  status: JobStatus;
  jobType: JobType;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId?: Id<"users">;
  assigneeName?: string | null;
  notes?: string;
  checklistType: "CLEANING" | "INSPECTION" | null;
  canStartChecklist: boolean;
};

type DispatchDetail = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  servicePlanId?: Id<"servicePlans">;
  assigneeId?: Id<"users">;
  scheduledStart: number;
  scheduledEnd: number;
  status: JobStatus;
  jobType: JobType;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  notes?: string;
  linkedInspectionId?: Id<"inspections">;
  checklistType: "CLEANING" | "INSPECTION" | null;
  property?: {
    _id: Id<"properties">;
    name: string;
    address: string;
    timezone?: string;
    serviceNotes?: string;
    accessInstructions?: string;
    entryMethod?: string;
    isActive: boolean;
    isArchived?: boolean;
  } | null;
  servicePlan?: {
    _id: Id<"servicePlans">;
    defaultAssigneeRole: "CLEANER" | "INSPECTOR";
  } | null;
  assignee?: {
    _id: Id<"users">;
    name: string;
    role: UserRole;
    isActive: boolean;
  } | null;
  events: Array<{
    _id: Id<"jobEvents">;
    eventType: string;
    metadata?: string;
    createdAt: number;
  }>;
};

type AdminUser = {
  _id: Id<"users">;
  name: string;
  role: UserRole;
  isActive: boolean;
};

type AdminProperty = {
  _id: Id<"properties">;
  name: string;
};

type PropertyAssignment = {
  _id: Id<"propertyAssignments">;
  userId: Id<"users">;
  assignmentRole: "CLEANER" | "INSPECTOR";
  isActive: boolean;
  user?: AdminUser | null;
};

type ViewMode = "week" | "day";
type SavingAction = "assign" | "reschedule" | "status" | "checklist" | null;

const dispatchStatuses: JobStatus[] = ["SCHEDULED", "IN_PROGRESS", "BLOCKED", "CANCELLED"];
const allStatuses: Array<"ALL" | JobStatus> = [
  "ALL",
  "SCHEDULED",
  "IN_PROGRESS",
  "BLOCKED",
  "CANCELLED",
  "COMPLETED",
];
const jobTypes: Array<JobType | "ALL"> = [
  "ALL",
  "CLEANING",
  "INSPECTION",
  "DEEP_CLEAN",
  "MAINTENANCE",
];

function startOfDayLocal(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDayLocal(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeekLocal(value: Date) {
  const next = startOfDayLocal(value);
  const day = next.getDay();
  const mondayOffset = (day + 6) % 7;
  next.setDate(next.getDate() - mondayOffset);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function sameLocalDate(timestamp: number, date: Date) {
  const value = new Date(timestamp);
  return (
    value.getFullYear() === date.getFullYear() &&
    value.getMonth() === date.getMonth() &&
    value.getDate() === date.getDate()
  );
}

function toDatetimeLocalValue(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  return new Date(value).getTime();
}

function formatWindowLabel(start: Date, end: Date) {
  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function statusTone(status: JobStatus) {
  switch (status) {
    case "SCHEDULED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "IN_PROGRESS":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "BLOCKED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "COMPLETED":
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function summarizeMetadata(metadata?: string) {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const parts = Object.entries(parsed)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`);

    return parts.length > 0 ? parts.join(" | ") : null;
  } catch {
    return null;
  }
}

function requiredRoleForJob(job: Pick<DispatchDetail, "jobType" | "servicePlan">) {
  if (job.jobType === "INSPECTION") {
    return "INSPECTOR";
  }

  if (job.jobType === "MAINTENANCE") {
    return job.servicePlan?.defaultAssigneeRole ?? "CLEANER";
  }

  return "CLEANER";
}

export function AdminSchedulePage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => startOfDayLocal(new Date()));
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<"ALL" | "UNASSIGNED" | Id<"users">>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<"ALL" | Id<"properties">>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [jobTypeFilter, setJobTypeFilter] = useState<JobType | "ALL">("ALL");
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | "">("");
  const [scheduledStartInput, setScheduledStartInput] = useState("");
  const [scheduledEndInput, setScheduledEndInput] = useState("");
  const [statusInput, setStatusInput] = useState<JobStatus>("SCHEDULED");
  const [savingAction, setSavingAction] = useState<SavingAction>(null);

  const windowStart = useMemo(() => {
    return viewMode === "week" ? startOfWeekLocal(anchorDate) : startOfDayLocal(anchorDate);
  }, [anchorDate, viewMode]);
  const windowEnd = useMemo(() => {
    return endOfDayLocal(viewMode === "week" ? addDays(windowStart, 6) : windowStart);
  }, [viewMode, windowStart]);
  const visibleDays = useMemo(() => {
    const totalDays = viewMode === "week" ? 7 : 1;
    return Array.from({ length: totalDays }, (_, index) => addDays(windowStart, index));
  }, [viewMode, windowStart]);

  const jobs = useQuery(api.jobs.listAdminDispatch, {
    from: windowStart.getTime(),
    to: windowEnd.getTime(),
  }) as DispatchJob[] | undefined;
  const selectedJob = useQuery(
    api.jobs.getById,
    selectedJobId ? { jobId: selectedJobId } : "skip"
  ) as DispatchDetail | null | undefined;
  const users = useQuery(api.users.list) as AdminUser[] | undefined;
  const properties = useQuery(api.properties.listAdmin, { includeArchived: false }) as
    | AdminProperty[]
    | undefined;
  const propertyAssignments = useQuery(
    api.propertyAssignments.listByProperty,
    selectedJob ? { propertyId: selectedJob.propertyId } : "skip"
  ) as PropertyAssignment[] | undefined;

  const reassignJob = useMutation(api.jobs.reassign);
  const rescheduleJob = useMutation(api.jobs.reschedule);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const createInspection = useMutation(api.inspections.create);

  const assigneeUsers = useMemo(() => {
    return (users ?? [])
      .filter((user) => user.isActive && (user.role === "CLEANER" || user.role === "INSPECTOR"))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [users]);

  const filteredJobs = useMemo(() => {
    return (jobs ?? []).filter((job) => {
      if (assigneeFilter === "UNASSIGNED" && job.assigneeId) {
        return false;
      }

      if (
        assigneeFilter !== "ALL" &&
        assigneeFilter !== "UNASSIGNED" &&
        job.assigneeId !== assigneeFilter
      ) {
        return false;
      }

      if (propertyFilter !== "ALL" && job.propertyId !== propertyFilter) {
        return false;
      }

      if (statusFilter !== "ALL" && job.status !== statusFilter) {
        return false;
      }

      if (jobTypeFilter !== "ALL" && job.jobType !== jobTypeFilter) {
        return false;
      }

      return true;
    });
  }, [assigneeFilter, jobTypeFilter, jobs, propertyFilter, statusFilter]);

  const jobsByDay = useMemo(() => {
    return visibleDays.map((day) =>
      filteredJobs
        .filter((job) => sameLocalDate(job.scheduledStart, day))
        .sort((left, right) => left.scheduledStart - right.scheduledStart)
    );
  }, [filteredJobs, visibleDays]);

  const listJobs = useMemo(() => {
    return filteredJobs.slice().sort((left, right) => left.scheduledStart - right.scheduledStart);
  }, [filteredJobs]);

  const summary = useMemo(() => {
    return {
      total: filteredJobs.length,
      unassigned: filteredJobs.filter((job) => !job.assigneeId).length,
      inProgress: filteredJobs.filter((job) => job.status === "IN_PROGRESS").length,
      blocked: filteredJobs.filter((job) => job.status === "BLOCKED").length,
    };
  }, [filteredJobs]);

  const eligibleAssignees = useMemo(() => {
    if (!selectedJob || !propertyAssignments) {
      return [];
    }

    const requiredRole = requiredRoleForJob(selectedJob);
    const byUserId = new Map<Id<"users">, AdminUser>();

    for (const assignment of propertyAssignments) {
      const user = assignment.user;
      if (
        assignment.isActive &&
        assignment.assignmentRole === requiredRole &&
        user &&
        user.isActive &&
        user.role === requiredRole
      ) {
        byUserId.set(user._id, user);
      }
    }

    if (
      selectedJob.assignee &&
      selectedJob.assignee.isActive &&
      selectedJob.assignee.role === requiredRole &&
      !byUserId.has(selectedJob.assignee._id)
    ) {
      byUserId.set(selectedJob.assignee._id, selectedJob.assignee);
    }

    return Array.from(byUserId.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [propertyAssignments, selectedJob]);

  const controlsLocked =
    !selectedJob ||
    selectedJob.status === "COMPLETED" ||
    selectedJob.property?.isActive === false ||
    selectedJob.property?.isArchived === true;

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !filteredJobs.some((job) => job._id === selectedJobId)) {
      setSelectedJobId(filteredJobs[0]._id);
    }
  }, [filteredJobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) {
      return;
    }

    setAssigneeId(selectedJob.assignee?._id ?? "");
    setScheduledStartInput(toDatetimeLocalValue(selectedJob.scheduledStart));
    setScheduledEndInput(toDatetimeLocalValue(selectedJob.scheduledEnd));
    setStatusInput(selectedJob.status);
  }, [selectedJob]);

  function shiftWindow(direction: -1 | 1) {
    setAnchorDate((current) => addDays(current, direction * (viewMode === "week" ? 7 : 1)));
  }

  async function handleAssign() {
    if (!selectedJob || !assigneeId) {
      return;
    }

    setSavingAction("assign");
    try {
      await reassignJob({
        jobId: selectedJob._id,
        assigneeId,
      });
      toast.success("Job reassigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update assignee");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleReschedule() {
    if (!selectedJob) {
      return;
    }

    const scheduledStart = fromDatetimeLocalValue(scheduledStartInput);
    const scheduledEnd = fromDatetimeLocalValue(scheduledEndInput);

    if (!Number.isFinite(scheduledStart) || !Number.isFinite(scheduledEnd)) {
      toast.error("Enter valid start and end times");
      return;
    }

    setSavingAction("reschedule");
    try {
      await rescheduleJob({
        jobId: selectedJob._id,
        scheduledStart,
        scheduledEnd,
      });
      toast.success("Job rescheduled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reschedule job");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleStatusSave() {
    if (!selectedJob) {
      return;
    }

    setSavingAction("status");
    try {
      await updateStatus({
        jobId: selectedJob._id,
        status: statusInput,
      });
      toast.success("Job status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleChecklist() {
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

    if (!selectedJob.assigneeId) {
      toast.error("Assign the job before starting a checklist");
      return;
    }

    setSavingAction("checklist");
    try {
      const inspectionId = await createInspection({
        propertyId: selectedJob.propertyId,
        type: selectedJob.checklistType,
        jobId: selectedJob._id,
      });
      toast.success("Checklist started from dispatch");
      navigate(`/checklists/${inspectionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checklist");
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dispatch Schedule</h1>
          <p className="text-sm text-slate-600">
            Admin board for staffing, rescheduling, and real-time job status control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="field-button secondary px-4" onClick={() => shiftWindow(-1)} type="button">
            Previous
          </button>
          <button
            className="field-button secondary px-4"
            onClick={() => setAnchorDate(startOfDayLocal(new Date()))}
            type="button"
          >
            Today
          </button>
          <button className="field-button secondary px-4" onClick={() => shiftWindow(1)} type="button">
            Next
          </button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Jobs In Window" value={summary.total} />
        <SummaryCard label="Unassigned" value={summary.unassigned} />
        <SummaryCard label="In Progress" value={summary.inProgress} />
        <SummaryCard label="Blocked" value={summary.blocked} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Window Controls</h2>
            <p className="text-sm text-slate-600">{formatWindowLabel(windowStart, windowEnd)}</p>
          </div>

          <div className="inline-flex rounded-2xl border border-border bg-slate-50 p-1">
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "week" ? "bg-brand-700 text-white" : "text-slate-600"
              }`}
              onClick={() => setViewMode("week")}
              type="button"
            >
              Week
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "day" ? "bg-brand-700 text-white" : "text-slate-600"
              }`}
              onClick={() => setViewMode("day")}
              type="button"
            >
              Day
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Assignee
            <select
              className="input mt-1"
              value={assigneeFilter}
              onChange={(event) =>
                setAssigneeFilter(event.target.value as "ALL" | "UNASSIGNED" | Id<"users">)
              }
            >
              <option value="ALL">All assignees</option>
              <option value="UNASSIGNED">Unassigned only</option>
              {assigneeUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Property
            <select
              className="input mt-1"
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value as "ALL" | Id<"properties">)}
            >
              <option value="ALL">All properties</option>
              {(properties ?? []).map((property) => (
                <option key={property._id} value={property._id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className="input mt-1"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | JobStatus)}
            >
              {allStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Job Type
            <select
              className="input mt-1"
              value={jobTypeFilter}
              onChange={(event) => setJobTypeFilter(event.target.value as JobType | "ALL")}
            >
              {jobTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All job types" : type}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{viewMode === "week" ? "Week Board" : "Day Board"}</h2>
                <p className="text-sm text-slate-600">
                  Click any job to open dispatch controls and recent job history.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {filteredJobs.length} visible
              </span>
            </div>

            {jobs === undefined ? (
              <p className="text-sm text-slate-500">Loading dispatch board...</p>
            ) : filteredJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No jobs match the current filters.</p>
            ) : viewMode === "week" ? (
              <div className="grid gap-3 lg:grid-cols-7">
                {visibleDays.map((day, index) => (
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
                          <JobCard
                            key={job._id}
                            job={job}
                            isActive={selectedJobId === job._id}
                            onSelect={setSelectedJobId}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {jobsByDay[0].map((job) => (
                  <JobRow
                    key={job._id}
                    job={job}
                    isActive={selectedJobId === job._id}
                    onSelect={setSelectedJobId}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="mb-3 text-lg font-bold">Filtered Job List</h2>
            {jobs === undefined ? (
              <p className="text-sm text-slate-500">Loading jobs...</p>
            ) : listJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No dispatch jobs in this window.</p>
            ) : (
              <div className="space-y-2">
                {listJobs.map((job) => (
                  <JobRow
                    key={job._id}
                    job={job}
                    isActive={selectedJobId === job._id}
                    onSelect={setSelectedJobId}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Dispatch Drawer</h2>
          {!selectedJobId ? (
            <p className="text-sm text-slate-500">Select a job to manage staffing and timing.</p>
          ) : selectedJob === undefined ? (
            <p className="text-sm text-slate-500">Loading job details...</p>
          ) : !selectedJob ? (
            <p className="text-sm text-slate-500">Job not found.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{selectedJob.property?.name ?? "Unknown property"}</p>
                    <p className="text-sm text-slate-600">
                      {selectedJob.property?.address ?? "No address on file"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                      selectedJob.status
                    )}`}
                  >
                    {selectedJob.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {selectedJob.jobType} | {new Date(selectedJob.scheduledStart).toLocaleString()} -{" "}
                  {new Date(selectedJob.scheduledEnd).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Priority: {selectedJob.priority ?? "MEDIUM"}
                  {selectedJob.assignee ? ` | ${selectedJob.assignee.name}` : " | Unassigned"}
                  {selectedJob.property?.timezone ? ` | ${selectedJob.property.timezone}` : ""}
                </p>
              </div>

              {(selectedJob.property?.isArchived || selectedJob.property?.isActive === false) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Dispatch edits are blocked because this property is archived or inactive.
                </div>
              )}

              {selectedJob.notes && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Job Notes</p>
                  <p className="text-sm text-slate-600">{selectedJob.notes}</p>
                </div>
              )}

              {selectedJob.property?.serviceNotes && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Service Notes</p>
                  <p className="text-sm text-slate-600">{selectedJob.property.serviceNotes}</p>
                </div>
              )}

              {selectedJob.property?.accessInstructions && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Access Instructions</p>
                  <p className="text-sm text-slate-600">{selectedJob.property.accessInstructions}</p>
                </div>
              )}

              {selectedJob.property?.entryMethod && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Entry Method</p>
                  <p className="text-sm text-slate-600">{selectedJob.property.entryMethod}</p>
                </div>
              )}

              <button
                className="field-button primary w-full px-4"
                disabled={
                  savingAction === "checklist" ||
                  selectedJob.checklistType === null ||
                  !selectedJob.assigneeId ||
                  selectedJob.status === "COMPLETED" ||
                  selectedJob.status === "CANCELLED"
                }
                onClick={() => void handleChecklist()}
                type="button"
              >
                {savingAction === "checklist"
                  ? "Opening..."
                  : selectedJob.linkedInspectionId
                    ? "Open Linked Checklist"
                    : "Start Checklist"}
              </button>

              <section className="rounded-2xl border border-border p-4">
                <div className="mb-2">
                  <h3 className="font-semibold">Assignee</h3>
                  <p className="text-sm text-slate-600">
                    Eligible staff come from active property assignments.
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  Assigned Staff
                  <select
                    className="input mt-1"
                    disabled={controlsLocked || propertyAssignments === undefined}
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value as Id<"users"> | "")}
                  >
                    <option value="">Select assignee</option>
                    {eligibleAssignees.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </label>
                {propertyAssignments !== undefined && eligibleAssignees.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No active property assignments match this job type yet.
                  </p>
                )}
                <button
                  className="field-button secondary mt-3 w-full px-4"
                  disabled={
                    controlsLocked ||
                    savingAction === "assign" ||
                    !assigneeId ||
                    assigneeId === (selectedJob.assignee?._id ?? "")
                  }
                  onClick={() => void handleAssign()}
                  type="button"
                >
                  {savingAction === "assign" ? "Saving..." : "Save Assignee"}
                </button>
              </section>

              <section className="rounded-2xl border border-border p-4">
                <div className="mb-2">
                  <h3 className="font-semibold">Reschedule</h3>
                  <p className="text-sm text-slate-600">
                    Conflict checks run against the selected assignee&apos;s other active jobs.
                  </p>
                </div>
                <div className="grid gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Start
                    <input
                      className="input mt-1"
                      disabled={controlsLocked}
                      type="datetime-local"
                      value={scheduledStartInput}
                      onChange={(event) => setScheduledStartInput(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    End
                    <input
                      className="input mt-1"
                      disabled={controlsLocked}
                      type="datetime-local"
                      value={scheduledEndInput}
                      onChange={(event) => setScheduledEndInput(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="field-button secondary mt-3 w-full px-4"
                  disabled={
                    controlsLocked ||
                    savingAction === "reschedule" ||
                    scheduledStartInput.length === 0 ||
                    scheduledEndInput.length === 0 ||
                    (scheduledStartInput === toDatetimeLocalValue(selectedJob.scheduledStart) &&
                      scheduledEndInput === toDatetimeLocalValue(selectedJob.scheduledEnd))
                  }
                  onClick={() => void handleReschedule()}
                  type="button"
                >
                  {savingAction === "reschedule" ? "Saving..." : "Save Timing"}
                </button>
              </section>

              <section className="rounded-2xl border border-border p-4">
                <div className="mb-2">
                  <h3 className="font-semibold">Status</h3>
                  <p className="text-sm text-slate-600">
                    Dispatch can move jobs through scheduled, active, blocked, and cancelled states.
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="input mt-1"
                    disabled={controlsLocked || selectedJob.status === "COMPLETED"}
                    value={statusInput}
                    onChange={(event) => setStatusInput(event.target.value as JobStatus)}
                  >
                    {selectedJob.status === "COMPLETED" && <option value="COMPLETED">COMPLETED</option>}
                    {dispatchStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="field-button secondary mt-3 w-full px-4"
                  disabled={
                    controlsLocked ||
                    savingAction === "status" ||
                    selectedJob.status === "COMPLETED" ||
                    statusInput === selectedJob.status
                  }
                  onClick={() => void handleStatusSave()}
                  type="button"
                >
                  {savingAction === "status" ? "Saving..." : "Save Status"}
                </button>
              </section>

              <section>
                <h3 className="mb-2 font-semibold">Recent Events</h3>
                {selectedJob.events.length === 0 ? (
                  <p className="text-sm text-slate-500">No job events recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedJob.events.slice(0, 8).map((event) => {
                      const metadataSummary = summarizeMetadata(event.metadata);
                      return (
                        <div key={event._id} className="rounded-2xl border border-border bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{event.eventType}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {metadataSummary && <p className="mt-1 text-xs text-slate-500">{metadataSummary}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </aside>
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

function JobCard({
  job,
  isActive,
  onSelect,
}: {
  job: DispatchJob;
  isActive: boolean;
  onSelect: (jobId: Id<"jobs">) => void;
}) {
  return (
    <button
      className={`w-full rounded-2xl border p-3 text-left transition ${
        isActive ? "border-brand-500 bg-brand-50" : "border-border bg-white hover:border-brand-300"
      }`}
      onClick={() => onSelect(job._id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          {new Date(job.scheduledStart).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(job.status)}`}>
          {job.status}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{job.propertyName}</p>
      <p className="text-xs text-slate-600">{job.jobType}</p>
      <p className="mt-1 text-xs text-slate-500">{job.assigneeName ?? "Unassigned"}</p>
    </button>
  );
}

function JobRow({
  job,
  isActive,
  onSelect,
}: {
  job: DispatchJob;
  isActive: boolean;
  onSelect: (jobId: Id<"jobs">) => void;
}) {
  return (
    <button
      className={`w-full rounded-2xl border p-3 text-left transition ${
        isActive ? "border-brand-500 bg-brand-50" : "border-border bg-white hover:border-brand-300"
      }`}
      onClick={() => onSelect(job._id)}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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
            {job.assigneeName ?? "Unassigned"} | Priority: {job.priority ?? "MEDIUM"}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(job.status)}`}>
          {job.status}
        </span>
      </div>
    </button>
  );
}
