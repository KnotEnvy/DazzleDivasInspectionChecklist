import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Inbox,
  Plus,
} from "lucide-react";
import { statusTone } from "@/lib/statusColors";
import { EmptyState } from "@/components/EmptyState";

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type JobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type IntakeSource = "EMAIL" | "TEXT" | "PHONE" | "MANUAL";
type ViewMode = "month" | "week" | "day";
type SavingAction =
  | "create"
  | "assign"
  | "reschedule"
  | "status"
  | "saveAll"
  | "checklist"
  | "delete"
  | null;

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

function startOfMonthLocal(value: Date) {
  const next = startOfDayLocal(value);
  next.setDate(1);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthGridStart(value: Date) {
  return startOfWeekLocal(startOfMonthLocal(value));
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

function urgencyBorder(scheduledStart: number) {
  const hoursUntil = (scheduledStart - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 0) return "border-l-4 border-l-rose-500";
  if (hoursUntil <= 24) return "border-l-4 border-l-amber-400";
  if (hoursUntil <= 48) return "border-l-4 border-l-sky-300";
  return "";
}

function urgencyLabel(scheduledStart: number) {
  const hoursUntil = (scheduledStart - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 0) return "Overdue";
  if (hoursUntil <= 6) return "Due soon";
  if (hoursUntil <= 24) return "Within 24h";
  if (hoursUntil <= 48) return "Within 48h";
  return null;
}

function getDeleteBlockReason(job: DispatchDetail | null | undefined) {
  if (!job) {
    return "Select a job to delete";
  }

  if (job.linkedInspectionId) {
    return "Jobs with linked checklists stay protected. Cancel them instead.";
  }

  if (job.status === "IN_PROGRESS") {
    return "In-progress jobs cannot be deleted.";
  }

  if (job.status === "COMPLETED") {
    return "Completed jobs are kept for history.";
  }

  return null;
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
  const [quickAssigningJobId, setQuickAssigningJobId] = useState<Id<"jobs"> | null>(null);
  const [quickAssigneeByJobId, setQuickAssigneeByJobId] = useState<
    Record<string, Id<"users"> | "">
  >({});
  const [createForm, setCreateForm] = useState(buildDefaultCreateForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAllUnassigned, setShowAllUnassigned] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const windowStart = useMemo(() => {
    if (viewMode === "month") {
      return monthGridStart(anchorDate);
    }
    return viewMode === "week" ? startOfWeekLocal(anchorDate) : startOfDayLocal(anchorDate);
  }, [anchorDate, viewMode]);
  const windowEnd = useMemo(() => {
    if (viewMode === "month") {
      return endOfDayLocal(addDays(windowStart, 41));
    }
    return endOfDayLocal(viewMode === "week" ? addDays(windowStart, 6) : windowStart);
  }, [viewMode, windowStart]);
  const visibleDays = useMemo(() => {
    const totalDays = viewMode === "month" ? 42 : viewMode === "week" ? 7 : 1;
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
  const deleteJob = useMutation(api.jobs.remove);
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
  const monthWeeks = useMemo(() => {
    if (viewMode !== "month") {
      return [];
    }

    return Array.from({ length: 6 }, (_, weekIndex) =>
      visibleDays.slice(weekIndex * 7, weekIndex * 7 + 7)
    );
  }, [viewMode, visibleDays]);

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
    setConfirmAction(null);
  }, [selectedJob]);

  useEffect(() => {
    if (unassignedJobs.length === 0) {
      return;
    }

    setQuickAssigneeByJobId((current) => {
      const next = { ...current };
      for (const job of unassignedJobs) {
        if (!(job._id in next)) {
          next[job._id] = "";
        }
      }
      return next;
    });
  }, [unassignedJobs]);

  function shiftWindow(direction: -1 | 1) {
    setAnchorDate((current) => {
      if (viewMode === "month") {
        return addMonths(current, direction);
      }
      return addDays(current, direction * (viewMode === "week" ? 7 : 1));
    });
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

  async function handleDeleteJob() {
    if (!selectedJob) {
      return;
    }

    setSavingAction("delete");
    try {
      await deleteJob({
        jobId: selectedJob._id,
      });
      toast.success("Job deleted from dispatch");
      setConfirmAction(null);
      setSelectedJobId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleSaveAllDispatchChanges() {
    if (!selectedJob) {
      return;
    }

    const nextAssigneeId = assigneeId.length > 0 ? assigneeId : null;
    const hasAssignmentChange = nextAssigneeId !== (selectedJob.assignee?._id ?? null);
    const hasTimingChange =
      scheduledStartInput !== toDatetimeLocalValue(selectedJob.scheduledStart) ||
      scheduledEndInput !== toDatetimeLocalValue(selectedJob.scheduledEnd);
    const hasStatusChange =
      selectedJob.status !== "COMPLETED" && statusInput !== selectedJob.status;

    if (!hasAssignmentChange && !hasTimingChange && !hasStatusChange) {
      toast("No dispatch changes to save");
      return;
    }

    const scheduledStart = fromDatetimeLocalValue(scheduledStartInput);
    const scheduledEnd = fromDatetimeLocalValue(scheduledEndInput);
    if (
      hasTimingChange &&
      (!Number.isFinite(scheduledStart) || !Number.isFinite(scheduledEnd))
    ) {
      toast.error("Enter valid start and end times");
      return;
    }

    setSavingAction("saveAll");
    try {
      if (hasAssignmentChange) {
        await reassignJob({
          jobId: selectedJob._id,
          assigneeId: nextAssigneeId,
        });
      }

      if (hasTimingChange) {
        await rescheduleJob({
          jobId: selectedJob._id,
          scheduledStart,
          scheduledEnd,
        });
      }

      if (hasStatusChange) {
        await updateStatus({
          jobId: selectedJob._id,
          status: statusInput,
        });
      }

      toast.success("Dispatch changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save dispatch changes");
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

  async function handleQuickAssign(job: DispatchJob) {
    const nextAssigneeId = quickAssigneeByJobId[job._id];
    if (!nextAssigneeId) {
      toast.error("Choose a staff member first");
      return;
    }

    setQuickAssigningJobId(job._id);
    try {
      await reassignJob({
        jobId: job._id,
        assigneeId: nextAssigneeId,
      });
      toast.success("Job assigned from queue");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign job");
    } finally {
      setQuickAssigningJobId(null);
    }
  }

  function eligibleAssigneesForDispatchJob(job: Pick<DispatchJob, "jobType">) {
    const requiredRole = requiredRoleForJobType(job.jobType);
    return assigneeUsers.filter((user) => user.role === requiredRole);
  }

  const selectedAssigneeValue = selectedJob?.assignee?._id ?? "";
  const hasDispatchChanges =
    !!selectedJob &&
    (assigneeId !== selectedAssigneeValue ||
      scheduledStartInput !== toDatetimeLocalValue(selectedJob.scheduledStart) ||
      scheduledEndInput !== toDatetimeLocalValue(selectedJob.scheduledEnd) ||
      (selectedJob.status !== "COMPLETED" && statusInput !== selectedJob.status));
  const deleteBlockReason = getDeleteBlockReason(selectedJob);
  const canDeleteSelectedJob = !!selectedJob && deleteBlockReason === null;
  const windowLabel =
    viewMode === "month"
      ? anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : formatWindowLabel(windowStart, windowEnd);

  return (
    <div className="animate-fade-in space-y-5">
      {/* â”€â”€ Header + nav + view toggle â”€â”€ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dispatch Schedule</h1>
          <p className="text-sm text-slate-600">{windowLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button className="field-button secondary px-3" onClick={() => shiftWindow(-1)} type="button">
              &larr;
            </button>
            <button
              className="field-button secondary px-3"
              onClick={() => setAnchorDate(startOfDayLocal(new Date()))}
              type="button"
            >
              Today
            </button>
            <button className="field-button secondary px-3" onClick={() => shiftWindow(1)} type="button">
              &rarr;
            </button>
          </div>
          <div className="inline-flex rounded-full border border-border bg-slate-100 p-1 shadow-inner">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={`min-h-[36px] rounded-full px-4 text-sm font-bold capitalize transition ${
                  viewMode === mode ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:text-brand-700"
                }`}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Summary pills â”€â”€ */}
      <section className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">
          {summary.total} jobs
        </span>
        {summary.unassigned > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
            {summary.unassigned} unassigned
          </span>
        )}
        {summary.inProgress > 0 && (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {summary.inProgress} active
          </span>
        )}
        {summary.blocked > 0 && (
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">
            {summary.blocked} blocked
          </span>
        )}
      </section>

      {/* â”€â”€ Quick Add + Unassigned Queue â”€â”€ */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-white">
          <button
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
            onClick={() => setShowCreateForm(!showCreateForm)}
            type="button"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="text-lg font-bold">Quick Add Turnover Job</h2>
                <p className="text-sm text-slate-600">Create a clean for a specific day and assign it now or later.</p>
              </div>
            </div>
            {showCreateForm ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
            ) : (

              <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
            )}
          </button>
          {showCreateForm && (
          <div className="border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              Guest Arrival Deadline
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
              className="input mt-1 min-h-20"
              placeholder="Cleaning instructions, guest issues, or dispatch notes"
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              className="field-button primary px-6"
              disabled={savingAction === "create"}
              onClick={() => void handleCreateJob()}
              type="button"
            >
              {savingAction === "create" ? "Creating..." : "Add Turnover"}
            </button>
          </div>
          </div>
          )}
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
            <div className="space-y-2">
              <div className="skeleton h-20 rounded-xl" />
              <div className="skeleton h-20 rounded-xl" />
            </div>
          ) : unassignedJobs.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8" />}
              heading="Queue is clear"
              description="All jobs in this window have been assigned."
            />
          ) : (
            <div className="space-y-2">
              {(showAllUnassigned ? unassignedJobs : unassignedJobs.slice(0, 5)).map((job) => {
                const urgency = urgencyLabel(job.scheduledStart);
                return (
                <div
                  key={job._id}
                  className={`rounded-2xl border p-3 transition ${urgencyBorder(job.scheduledStart)} ${
                    selectedJobId === job._id
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-slate-50"
                  }`}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => setSelectedJobId(job._id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{job.propertyName}</p>
                      {urgency && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          urgency === "Overdue" ? "bg-rose-100 text-rose-700"
                            : urgency === "Due soon" ? "bg-amber-100 text-amber-700"
                            : "bg-sky-100 text-sky-700"
                        }`}>
                          {urgency}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{formatJobWindow(job)}</p>
                    <p className="text-xs text-slate-500">{job.jobType}</p>
                  </button>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      className="input"
                      value={quickAssigneeByJobId[job._id] ?? ""}
                      onChange={(event) =>
                        setQuickAssigneeByJobId((current) => ({
                          ...current,
                          [job._id]: event.target.value as Id<"users"> | "",
                        }))
                      }
                    >
                      <option value="">Pick assignee</option>
                      {eligibleAssigneesForDispatchJob(job).map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                    <button
                      className="field-button secondary px-4"
                      disabled={
                        quickAssigningJobId === job._id || !(quickAssigneeByJobId[job._id] ?? "")
                      }
                      onClick={() => void handleQuickAssign(job)}
                      type="button"
                    >
                      {quickAssigningJobId === job._id ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                </div>
                );
              })}
              {unassignedJobs.length > 5 && (
                <button
                  className="w-full rounded-xl py-2 text-center text-sm font-semibold text-brand-600 hover:text-brand-800 transition"
                  onClick={() => setShowAllUnassigned((prev) => !prev)}
                  type="button"
                >
                  {showAllUnassigned
                    ? "Show less"
                    : `Show all ${unassignedJobs.length} unassigned`}
                </button>
              )}
            </div>
          )}
        </section>
      </section>

      {/* â”€â”€ Filters â”€â”€ */}
      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-600">Filters</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <h2 className="text-lg font-bold">
                  {viewMode === "month"
                    ? "Month Board"
                    : viewMode === "week"
                      ? "Week Board"
                      : "Day Board"}
                </h2>
                <p className="text-sm text-slate-600">Manual jobs and recurring jobs appear together here.</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {filteredJobs.length} visible
              </span>
            </div>
            {jobs === undefined ? (
              <div className="space-y-3">
                <div className="skeleton h-24 rounded-xl" />
                <div className="skeleton h-24 rounded-xl" />
                <div className="skeleton h-24 rounded-xl" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                heading="No jobs match filters"
                description="Adjust the filters above or change the date window."
              />
            ) : viewMode === "month" ? (
              <div className="-mx-4 space-y-2 overflow-x-auto px-4 pb-2">
                {monthWeeks.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="flex gap-2"
                    style={{ minWidth: `${7 * 160}px` }}
                  >
                    {week.map((day) => {
                      const dayIndex = weekIndex * 7 + week.indexOf(day);
                      const dayJobs = jobsByDay[dayIndex] ?? [];
                      const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                      const isToday = sameLocalDate(Date.now(), day);
                      const unassignedCount = dayJobs.filter((j) => !j.assigneeName).length;

                      return (
                        <div
                          key={day.toISOString()}
                          className={`flex flex-1 flex-col rounded-xl border ${
                            isToday
                              ? "border-brand-400 bg-brand-50/30"
                              : isCurrentMonth
                                ? "border-border bg-slate-50/60"
                                : "border-slate-200 bg-slate-100/40"
                          }`}
                        >
                          {/* Day header */}
                          <div className={`flex items-center justify-between gap-1 rounded-t-xl px-2 py-1.5 ${
                            isToday ? "bg-brand-100/50" : isCurrentMonth ? "bg-slate-100/80" : "bg-slate-100/40"
                          }`}>
                            <div>
                              <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                                isToday ? "text-brand-700" : isCurrentMonth ? "text-slate-500" : "text-slate-400"
                              }`}>
                                {isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}
                              </p>
                              <p className={`text-xs font-semibold ${isCurrentMonth ? "text-slate-800" : "text-slate-400"}`}>
                                {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            {dayJobs.length > 0 && (
                              <div className="text-right leading-none">
                                <p className="text-[10px] font-semibold text-slate-500">{dayJobs.length}</p>
                                {unassignedCount > 0 && (
                                  <p className="text-[10px] font-bold text-amber-600">{unassignedCount} open</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Jobs */}
                          <div className="flex-1 space-y-1 p-1.5">
                            {dayJobs.length === 0 ? (
                              <p className="py-1 text-center text-[11px] text-slate-400">&mdash;</p>
                            ) : (
                              <>
                                {dayJobs.slice(0, 4).map((job) => {
                                  const isUnassigned = !job.assigneeName;
                                  return (
                                    <button
                                      key={job._id}
                                      className={`w-full rounded px-1.5 py-1 text-left text-[11px] transition ${
                                        isUnassigned
                                          ? "border border-dashed border-amber-300 bg-amber-50"
                                          : "border border-slate-200 bg-white"
                                      } ${
                                        selectedJobId === job._id
                                          ? "ring-2 ring-brand-400 ring-offset-1"
                                          : "hover:ring-1 hover:ring-brand-300"
                                      }`}
                                      onClick={() => setSelectedJobId(job._id)}
                                      type="button"
                                    >
                                      <p className="font-semibold leading-snug truncate text-slate-900">
                                        {job.propertyName}
                                      </p>
                                      <p className={`truncate text-[10px] ${isUnassigned ? "font-semibold text-amber-600" : "text-slate-500"}`}>
                                        {job.assigneeName ?? "Unassigned"}
                                      </p>
                                    </button>
                                  );
                                })}
                                {dayJobs.length > 4 && (
                                  <p className="text-center text-[10px] font-semibold text-slate-500">
                                    +{dayJobs.length - 4} more
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : viewMode === "week" ? (
              <div className="-mx-4 overflow-x-auto px-4 pb-2">
                <div className="flex gap-3" style={{ minWidth: `${visibleDays.length * 180}px` }}>
                  {visibleDays.map((day, index) => {
                    const isToday = sameLocalDate(Date.now(), day);
                    const dayJobs = jobsByDay[index];
                    const unassignedCount = dayJobs.filter((j) => !j.assigneeName).length;
                    const workerNames = [
                      ...new Set(dayJobs.map((j) => j.assigneeName).filter(Boolean)),
                    ] as string[];

                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex flex-1 flex-col rounded-xl border ${
                          isToday
                            ? "border-brand-400 bg-brand-50/30"
                            : "border-border bg-slate-50/60"
                        }`}
                      >
                        {/* Day header */}
                        <div className={`rounded-t-xl px-3 py-2 ${isToday ? "bg-brand-100/50" : "bg-slate-100/80"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isToday ? "text-brand-700" : "text-slate-500"}`}>
                                {isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}
                              </p>
                              <p className="text-sm font-semibold text-slate-800">
                                {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <div className="text-right">
                              {dayJobs.length > 0 && (
                                <p className="text-xs font-semibold text-slate-600">
                                  {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
                                </p>
                              )}
                              {unassignedCount > 0 && (
                                <p className="text-[11px] font-bold text-amber-600">
                                  {unassignedCount} open
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Jobs */}
                        <div className="flex-1 space-y-1.5 p-2">
                          {dayJobs.length === 0 ? (
                            <p className="py-4 text-center text-xs text-slate-400">No jobs</p>
                          ) : (
                            dayJobs.map((job) => {
                              const isUnassigned = !job.assigneeName;
                              return (
                                <button
                                  key={job._id}
                                  className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                                    isUnassigned
                                      ? "border border-dashed border-amber-300 bg-amber-50"
                                      : "border border-slate-200 bg-white"
                                  } ${
                                    selectedJobId === job._id
                                      ? "ring-2 ring-brand-400 ring-offset-1"
                                      : "hover:ring-1 hover:ring-brand-300 hover:ring-offset-1"
                                  }`}
                                  onClick={() => setSelectedJobId(job._id)}
                                  type="button"
                                >
                                  <p className="text-sm font-semibold leading-snug truncate text-slate-900">
                                    {job.propertyName}
                                  </p>
                                  <p className={`text-xs truncate ${isUnassigned ? "font-semibold text-amber-600" : "text-slate-500"}`}>
                                    {job.assigneeName ?? "Unassigned"}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Workers on this day */}
                        {workerNames.length > 0 && (
                          <div className="border-t border-border px-2 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {workerNames.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                                >
                                  {name.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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

        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Dispatch Drawer</h2>
          {!selectedJobId ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              heading="Select a job"
              description="Pick a job from the board or list to manage staffing and timing."
            />
          ) : selectedJob === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-24 rounded-xl" />
              <div className="skeleton h-6 w-2/3 rounded" />
              <div className="skeleton h-10 rounded-xl" />
              <div className="skeleton h-10 rounded-xl" />
            </div>
          ) : !selectedJob ? (
            <p className="text-sm text-slate-500">Job not found.</p>
          ) : (
            <div className="space-y-3">
              {/* Job header card */}
              <div className="rounded-2xl border border-border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{selectedJob.property?.name ?? "Unknown property"}</p>
                    <p className="text-xs text-slate-600">
                      {selectedJob.property?.address ?? "No address on file"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {selectedJob.jobType} | {formatJobWindow(selectedJob)}
                </p>
                <p className="text-xs text-slate-500">
                  Priority: {selectedJob.priority ?? "MEDIUM"}
                  {selectedJob.assignee ? ` | ${selectedJob.assignee.name}` : " | Unassigned"}
                </p>

                {/* Compact info rows — only show non-empty fields */}
                {(selectedJob.notes || selectedJob.arrivalDeadline || selectedJob.clientLabel) && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-slate-600">
                    {selectedJob.arrivalDeadline && (
                      <p><span className="font-semibold text-slate-700">Guest arrival:</span> {formatOptionalDateTime(selectedJob.arrivalDeadline)}</p>
                    )}
                    {selectedJob.clientLabel && (
                      <p><span className="font-semibold text-slate-700">Client:</span> {selectedJob.clientLabel}{selectedJob.intakeSource ? ` (${selectedJob.intakeSource})` : ""}</p>
                    )}
                    {selectedJob.notes && (
                      <p><span className="font-semibold text-slate-700">Notes:</span> {selectedJob.notes}</p>
                    )}
                  </div>
                )}

                {/* Property details — compact */}
                {(selectedJob.property?.serviceNotes || selectedJob.property?.accessInstructions || selectedJob.property?.entryMethod) && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-slate-600">
                    {selectedJob.property.accessInstructions && (
                      <p><span className="font-semibold text-slate-700">Access:</span> {selectedJob.property.accessInstructions}</p>
                    )}
                    {selectedJob.property.entryMethod && (
                      <p><span className="font-semibold text-slate-700">Entry:</span> {selectedJob.property.entryMethod}</p>
                    )}
                    {selectedJob.property.serviceNotes && (
                      <p><span className="font-semibold text-slate-700">Service notes:</span> {selectedJob.property.serviceNotes}</p>
                    )}
                  </div>
                )}
              </div>

              {(selectedJob.property?.isArchived || selectedJob.property?.isActive === false) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Dispatch edits are blocked — property is archived or inactive.
                </div>
              )}

              {/* Primary action */}
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

              {/* Consolidated dispatch controls */}
              <section className="rounded-2xl border border-border p-3 space-y-3">
                <h3 className="text-sm font-bold text-slate-600">Dispatch Controls</h3>

                <label className="block text-sm font-medium text-slate-700">
                  Assignee
                  <select
                    className="input mt-1"
                    disabled={controlsLocked}
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value as Id<"users"> | "")}
                  >
                    <option value="">Unassigned</option>
                    {eligibleAssignees.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Start
                    <input
                      className="input mt-1"
                      disabled={controlsLocked}
                      type="datetime-local"
                      value={scheduledStartInput}
                      onChange={(event) => setScheduledStartInput(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
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

                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="input mt-1"
                    disabled={controlsLocked || selectedJob.status === "COMPLETED"}
                    value={statusInput}
                    onChange={(event) => {
                      setStatusInput(event.target.value as JobStatus);
                      setConfirmAction(null);
                    }}
                  >
                    {selectedJob.status === "COMPLETED" && <option value="COMPLETED">COMPLETED</option>}
                    {dispatchStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                {confirmAction === "cancelStatus" ? (
                  <div className="animate-slide-up flex gap-2">
                    <button
                      className="field-button danger flex-1 px-4"
                      disabled={savingAction === "status"}
                      onClick={() => {
                        setConfirmAction(null);
                        void handleStatusSave();
                      }}
                      type="button"
                    >
                      {savingAction === "status" ? "Saving..." : "Confirm Cancel"}
                    </button>
                    <button
                      className="field-button ghost flex-1 px-4"
                      onClick={() => {
                        setConfirmAction(null);
                        setStatusInput(selectedJob.status);
                      }}
                      type="button"
                    >
                      Nevermind
                    </button>
                  </div>
                ) : (
                  <button
                    className="field-button primary w-full px-4"
                    disabled={controlsLocked || savingAction === "saveAll" || !hasDispatchChanges}
                    onClick={() => {
                      if (statusInput === "CANCELLED" && statusInput !== selectedJob.status) {
                        setConfirmAction("cancelStatus");
                        return;
                      }
                      void handleSaveAllDispatchChanges();
                    }}
                    type="button"
                  >
                    {savingAction === "saveAll" ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </section>

              {/* Delete — compact */}
              <section className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs text-rose-700">
                  {deleteBlockReason ?? "Remove this dispatch entry. Linked, in-progress, and completed jobs stay protected."}
                </p>
                {confirmAction === "deleteJob" ? (
                  <div className="animate-slide-up mt-2 flex gap-2">
                    <button
                      className="field-button danger flex-1 px-4"
                      disabled={!canDeleteSelectedJob || savingAction === "delete"}
                      onClick={() => {
                        setConfirmAction(null);
                        void handleDeleteJob();
                      }}
                      type="button"
                    >
                      {savingAction === "delete" ? "Deleting..." : "Confirm Delete"}
                    </button>
                    <button
                      className="field-button ghost flex-1 px-4"
                      onClick={() => setConfirmAction(null)}
                      type="button"
                    >
                      Keep Job
                    </button>
                  </div>
                ) : (
                  <button
                    className="field-button danger mt-2 w-full px-4"
                    disabled={!canDeleteSelectedJob || savingAction === "delete"}
                    onClick={() => setConfirmAction("deleteJob")}
                    type="button"
                  >
                    {savingAction === "delete" ? "Deleting..." : "Delete Job"}
                  </button>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-slate-600">Recent Events</h3>
                {selectedJob.events.length === 0 ? (
                  <p className="text-xs text-slate-400">No events recorded yet.</p>
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

function statusLeftBorder(status: JobStatus) {
  switch (status) {
    case "SCHEDULED": return "border-l-sky-400";
    case "IN_PROGRESS": return "border-l-emerald-400";
    case "BLOCKED": return "border-l-amber-400";
    case "CANCELLED": return "border-l-rose-400";
    case "COMPLETED": return "border-l-slate-300";
  }
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
      className={`w-full rounded-xl border-l-[3px] bg-white px-4 py-3 text-left transition ${statusLeftBorder(job.status)} ${
        isActive
          ? "ring-2 ring-brand-400 ring-offset-1"
          : "hover:ring-1 hover:ring-brand-200 hover:ring-offset-1"
      }`}
      onClick={() => onSelect(job._id)}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-slate-900">
              {new Date(job.scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
            <p className="truncate text-sm font-semibold text-slate-700">{job.propertyName}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {job.assigneeName ?? "Unassigned"} &middot; {job.jobType}
            {job.priority && job.priority !== "MEDIUM" ? ` &middot; ${job.priority}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(job.status)}`}>
          {job.status}
        </span>
      </div>
    </button>
  );
}


