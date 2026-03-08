import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type JobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type IntakeSource = "EMAIL" | "TEXT" | "PHONE" | "MANUAL";
type ViewMode = "week" | "day";
type SavingAction = "create" | "assign" | "reschedule" | "status" | "checklist" | null;

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
  priority?: Priority;
  intakeSource?: IntakeSource;
  clientLabel?: string;
  arrivalDeadline?: number;
  assigneeId?: Id<"users">;
  assigneeName?: string | null;
  notes?: string;
  checklistType: "CLEANING" | "INSPECTION" | null;
};

type DispatchDetail = {
  _id: Id<"jobs">;
  propertyId: Id<"properties">;
  scheduledStart: number;
  scheduledEnd: number;
  status: JobStatus;
  jobType: JobType;
  priority?: Priority;
  intakeSource?: IntakeSource;
  clientLabel?: string;
  arrivalDeadline?: number;
  assigneeId?: Id<"users">;
  notes?: string;
  linkedInspectionId?: Id<"inspections">;
  checklistType: "CLEANING" | "INSPECTION" | null;
  servicePlan?: {
    defaultAssigneeRole: "CLEANER" | "INSPECTOR";
  } | null;
  property?: {
    name: string;
    address: string;
    timezone?: string;
    serviceNotes?: string;
    accessInstructions?: string;
    entryMethod?: string;
    isActive: boolean;
    isArchived?: boolean;
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

function formatJobWindow(job: { scheduledStart: number; scheduledEnd: number }) {
  return `${new Date(job.scheduledStart).toLocaleString()} - ${new Date(job.scheduledEnd).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  )}`;
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

function requiredRoleForJobType(jobType: JobType) {
  return jobType === "INSPECTION" ? "INSPECTOR" : "CLEANER";
}

function buildDefaultCreateForm() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(Math.max(start.getHours() + 1, 10));
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return {
    propertyId: "" as Id<"properties"> | "",
    jobType: "CLEANING" as JobType,
    assigneeId: "" as Id<"users"> | "",
    scheduledStart: toDatetimeLocalValue(start.getTime()),
    scheduledEnd: toDatetimeLocalValue(end.getTime()),
    priority: "MEDIUM" as Priority,
    intakeSource: "MANUAL" as IntakeSource,
    clientLabel: "",
    arrivalDeadline: "",
    notes: "",
  };
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
  const [createForm, setCreateForm] = useState(buildDefaultCreateForm);

  const windowStart = useMemo(
    () => (viewMode === "week" ? startOfWeekLocal(anchorDate) : startOfDayLocal(anchorDate)),
    [anchorDate, viewMode]
  );
  const windowEnd = useMemo(
    () => endOfDayLocal(viewMode === "week" ? addDays(windowStart, 6) : windowStart),
    [viewMode, windowStart]
  );
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

  const createManualJob = useMutation(api.jobs.createManual);
  const reassignJob = useMutation(api.jobs.reassign);
  const rescheduleJob = useMutation(api.jobs.reschedule);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const createInspection = useMutation(api.inspections.create);

  const assigneeUsers = useMemo(
    () =>
      (users ?? [])
        .filter((user) => user.isActive && (user.role === "CLEANER" || user.role === "INSPECTOR"))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );

  const filteredJobs = useMemo(
    () =>
      (jobs ?? []).filter((job) => {
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
      }),
    [assigneeFilter, jobTypeFilter, jobs, propertyFilter, statusFilter]
  );

  const jobsByDay = useMemo(
    () =>
      visibleDays.map((day) =>
        filteredJobs
          .filter((job) => sameLocalDate(job.scheduledStart, day))
          .sort((left, right) => left.scheduledStart - right.scheduledStart)
      ),
    [filteredJobs, visibleDays]
  );

  const listJobs = useMemo(
    () => filteredJobs.slice().sort((left, right) => left.scheduledStart - right.scheduledStart),
    [filteredJobs]
  );
  const unassignedJobs = useMemo(() => listJobs.filter((job) => !job.assigneeId), [listJobs]);

  const summary = useMemo(
    () => ({
      total: filteredJobs.length,
      unassigned: filteredJobs.filter((job) => !job.assigneeId).length,
      inProgress: filteredJobs.filter((job) => job.status === "IN_PROGRESS").length,
      blocked: filteredJobs.filter((job) => job.status === "BLOCKED").length,
    }),
    [filteredJobs]
  );

  const eligibleAssignees = useMemo(() => {
    if (!selectedJob) {
      return [];
    }
    const requiredRole = requiredRoleForJob(selectedJob);
    const candidates = assigneeUsers.filter((user) => user.role === requiredRole);
    if (
      selectedJob.assignee &&
      selectedJob.assignee.role === requiredRole &&
      !candidates.some((user) => user._id === selectedJob.assignee!._id)
    ) {
      return [...candidates, selectedJob.assignee].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
    }
    return candidates;
  }, [assigneeUsers, selectedJob]);

  const eligibleCreateAssignees = useMemo(
    () => assigneeUsers.filter((user) => user.role === requiredRoleForJobType(createForm.jobType)),
    [assigneeUsers, createForm.jobType]
  );

  const controlsLocked =
    !selectedJob ||
    selectedJob.status === "COMPLETED" ||
    selectedJob.property?.isActive === false ||
    selectedJob.property?.isArchived === true;

  useEffect(() => {
    if (properties && properties.length > 0 && createForm.propertyId.length === 0) {
      setCreateForm((current) => ({ ...current, propertyId: properties[0]._id }));
    }
  }, [createForm.propertyId.length, properties]);

  useEffect(() => {
    if (
      createForm.assigneeId.length > 0 &&
      !eligibleCreateAssignees.some((user) => user._id === createForm.assigneeId)
    ) {
      setCreateForm((current) => ({ ...current, assigneeId: "" }));
    }
  }, [createForm.assigneeId, eligibleCreateAssignees]);

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

  async function handleCreateJob() {
    if (!createForm.propertyId) {
      toast.error("Choose a property");
      return;
    }
    const scheduledStart = fromDatetimeLocalValue(createForm.scheduledStart);
    const scheduledEnd = fromDatetimeLocalValue(createForm.scheduledEnd);
    if (!Number.isFinite(scheduledStart) || !Number.isFinite(scheduledEnd)) {
      toast.error("Enter a valid start and end time");
      return;
    }
    const arrivalDeadline =
      createForm.arrivalDeadline.length > 0
        ? fromDatetimeLocalValue(createForm.arrivalDeadline)
        : undefined;
    if (createForm.arrivalDeadline.length > 0 && !Number.isFinite(arrivalDeadline)) {
      toast.error("Enter a valid arrival deadline");
      return;
    }
    setSavingAction("create");
    try {
      const jobId = await createManualJob({
        propertyId: createForm.propertyId,
        jobType: createForm.jobType,
        scheduledStart,
        scheduledEnd,
        assigneeId: createForm.assigneeId.length > 0 ? createForm.assigneeId : undefined,
        priority: createForm.priority,
        intakeSource: createForm.intakeSource,
        clientLabel: createForm.clientLabel.trim() || undefined,
        arrivalDeadline,
        notes: createForm.notes.trim() || undefined,
      });
      toast.success("Dispatch job created");
      setSelectedJobId(jobId);
      setAnchorDate(startOfDayLocal(new Date(scheduledStart)));
      const nextDefaults = buildDefaultCreateForm();
      setCreateForm((current) => ({
        ...nextDefaults,
        propertyId: current.propertyId,
        jobType: current.jobType,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create job");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleAssign() {
    if (!selectedJob) {
      return;
    }
    setSavingAction("assign");
    try {
      await reassignJob({
        jobId: selectedJob._id,
        assigneeId: assigneeId.length > 0 ? assigneeId : null,
      });
      toast.success(assigneeId.length > 0 ? "Job assignment updated" : "Job moved to unassigned");
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

  const selectedAssigneeValue = selectedJob?.assignee?._id ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dispatch Schedule</h1>
          <p className="text-sm text-slate-600">
            Manual turnover dispatch for jobs coming in by email or text, with flexible daily assignment.
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Quick Add Turnover Job</h2>
            <p className="text-sm text-slate-600">Create a clean for a specific day and assign it now or later.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Property
              <select
                className="input mt-1"
                value={createForm.propertyId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    propertyId: event.target.value as Id<"properties"> | "",
                  }))
                }
              >
                <option value="">Select property</option>
                {(properties ?? []).map((property) => (
                  <option key={property._id} value={property._id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Job Type
              <select
                className="input mt-1"
                value={createForm.jobType}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    jobType: event.target.value as JobType,
                    assigneeId: "",
                  }))
                }
              >
                <option value="CLEANING">CLEANING</option>
                <option value="INSPECTION">INSPECTION</option>
                <option value="DEEP_CLEAN">DEEP_CLEAN</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Start
              <input
                className="input mt-1"
                type="datetime-local"
                value={createForm.scheduledStart}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, scheduledStart: event.target.value }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              End
              <input
                className="input mt-1"
                type="datetime-local"
                value={createForm.scheduledEnd}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, scheduledEnd: event.target.value }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Assignee
              <select
                className="input mt-1"
                value={createForm.assigneeId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    assigneeId: event.target.value as Id<"users"> | "",
                  }))
                }
              >
                <option value="">Leave unassigned</option>
                {eligibleCreateAssignees.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Intake Source
              <select
                className="input mt-1"
                value={createForm.intakeSource}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    intakeSource: event.target.value as IntakeSource,
                  }))
                }
              >
                <option value="MANUAL">MANUAL</option>
                <option value="EMAIL">EMAIL</option>
                <option value="TEXT">TEXT</option>
                <option value="PHONE">PHONE</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Priority
              <select
                className="input mt-1"
                value={createForm.priority}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    priority: event.target.value as Priority,
                  }))
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Client / Account
              <input
                className="input mt-1"
                placeholder="Airbnb PM team"
                value={createForm.clientLabel}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, clientLabel: event.target.value }))
                }
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Arrival Deadline
              <input
                className="input mt-1"
                type="datetime-local"
                value={createForm.arrivalDeadline}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, arrivalDeadline: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Job Notes
            <textarea
              className="input mt-1 min-h-24"
              placeholder="Cleaning instructions, guest issues, or dispatch notes"
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Property assignments can stay as preferences, but dispatch is no longer locked to them.
            </p>
            <button
              className="field-button primary px-4"
              disabled={savingAction === "create"}
              onClick={() => void handleCreateJob()}
              type="button"
            >
              {savingAction === "create" ? "Creating..." : "Create Dispatch Job"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Unassigned Queue</h2>
              <p className="text-sm text-slate-600">Jobs waiting for a cleaner in this window.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {unassignedJobs.length} open
            </span>
          </div>
          {jobs === undefined ? (
            <p className="text-sm text-slate-500">Loading queue...</p>
          ) : unassignedJobs.length === 0 ? (
            <p className="text-sm text-slate-500">No unassigned jobs in this window.</p>
          ) : (
            <div className="space-y-2">
              {unassignedJobs.slice(0, 8).map((job) => (
                <button
                  key={job._id}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedJobId === job._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-slate-50 hover:border-brand-300"
                  }`}
                  onClick={() => setSelectedJobId(job._id)}
                  type="button"
                >
                  <p className="font-semibold">{job.propertyName}</p>
                  <p className="text-sm text-slate-600">{formatJobWindow(job)}</p>
                  <p className="text-xs text-slate-500">{job.jobType}</p>
                </button>
              ))}
            </div>
          )}
        </section>
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
                <p className="text-sm text-slate-600">Manual jobs and recurring jobs appear together here.</p>
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
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {selectedJob.jobType} | {formatJobWindow(selectedJob)}
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
              {selectedJob.intakeSource && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Turnover Source</p>
                  <p className="text-sm text-slate-600">{selectedJob.intakeSource}</p>
                </div>
              )}
              {selectedJob.clientLabel && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Client / Account</p>
                  <p className="text-sm text-slate-600">{selectedJob.clientLabel}</p>
                </div>
              )}
              {selectedJob.arrivalDeadline && (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Arrival Deadline</p>
                  <p className="text-sm text-slate-600">
                    {formatOptionalDateTime(selectedJob.arrivalDeadline)}
                  </p>
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
                    Choose any active {requiredRoleForJob(selectedJob).toLowerCase()} or leave this job unassigned.
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  Assigned Staff
                  <select
                    className="input mt-1"
                    disabled={controlsLocked}
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value as Id<"users"> | "")}
                  >
                    <option value="">Leave unassigned</option>
                    {eligibleAssignees.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="field-button secondary mt-3 w-full px-4"
                  disabled={controlsLocked || savingAction === "assign" || assigneeId === selectedAssigneeValue}
                  onClick={() => void handleAssign()}
                  type="button"
                >
                  {savingAction === "assign" ? "Saving..." : "Save Assignment"}
                </button>
              </section>

              <section className="rounded-2xl border border-border p-4">
                <div className="mb-2">
                  <h3 className="font-semibold">Reschedule</h3>
                  <p className="text-sm text-slate-600">Move the clean to the correct day or time window.</p>
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
                  <p className="text-sm text-slate-600">Dispatch controls everything except `COMPLETED`.</p>
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
                      const summaryText = summarizeMetadata(event.metadata);
                      return (
                        <div key={event._id} className="rounded-2xl border border-border bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{event.eventType}</p>
                            <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                          </div>
                          {summaryText && <p className="mt-1 text-xs text-slate-500">{summaryText}</p>}
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
      {summarizeTurnoverIntake(job) && (
        <p className="mt-1 text-xs text-slate-500">{summarizeTurnoverIntake(job)}</p>
      )}
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
          <p className="text-sm text-slate-600">{formatJobWindow(job)}</p>
          <p className="text-xs text-slate-500">
            {job.assigneeName ?? "Unassigned"} | Priority: {job.priority ?? "MEDIUM"}
          </p>
          {summarizeTurnoverIntake(job) && (
            <p className="text-xs text-slate-500">{summarizeTurnoverIntake(job)}</p>
          )}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(job.status)}`}>
          {job.status}
        </span>
      </div>
    </button>
  );
}
