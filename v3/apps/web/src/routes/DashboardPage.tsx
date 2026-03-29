import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  LayoutTemplate,
  MapPin,
  Users,
} from "lucide-react";
import { ButterflyEmptyState } from "@/components/ButterflyEmptyState";
import { EmptyState } from "@/components/EmptyState";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { statusTone } from "@/lib/statusColors";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxItems } from "@/hooks/useOutboxItems";

const DAY_MS = 24 * 60 * 60 * 1000;

type ActiveInspection = {
  _id: string;
  propertyName: string;
  type: string;
  status: string;
};

type AssignedProperty = {
  _id: string;
  property?: {
    name?: string;
    address?: string;
  } | null;
};

type AdminStats = {
  users: number;
  activeProperties: number;
  activeInspections: number;
  completedInspections: number;
};

type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";

type AdminDispatchJob = {
  _id: string;
  propertyName: string;
  propertyAddress: string;
  scheduledStart: number;
  scheduledEnd: number;
  status: JobStatus;
  jobType: string;
  assigneeId?: string;
  assigneeName?: string | null;
  priority?: string;
  checklistType: string | null;
};

type StaffUser = {
  _id: string;
  name: string;
  role: "CLEANER" | "INSPECTOR";
  isActive: boolean;
};

type ScheduleJob = {
  _id: string;
  propertyName: string;
  propertyAddress: string;
  scheduledStart: number;
  scheduledEnd: number;
  linkedInspectionId?: string;
  checklistType: "CLEANING" | "INSPECTION" | null;
  canStartChecklist: boolean;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
  jobType: "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function formatJobWindow(job: Pick<ScheduleJob, "scheduledStart" | "scheduledEnd">) {
  const start = new Date(job.scheduledStart);
  const end = new Date(job.scheduledEnd);
  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} to ${end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function workerChecklistRank(job: ScheduleJob) {
  if (job.linkedInspectionId && job.status === "IN_PROGRESS") {
    return 0;
  }

  if (job.status === "IN_PROGRESS") {
    return 1;
  }

  if (job.linkedInspectionId) {
    return 2;
  }

  if (job.canStartChecklist) {
    return 3;
  }

  return 4;
}

export function DashboardPage() {
  const { user, isAdmin, isCleaner, isInspector } = useCurrentUser();
  const isOnline = useNetworkStatus();
  const { items } = useOutboxItems({ includeResolved: true });

  const active = useQuery(api.inspections.listActive) as ActiveInspection[] | undefined;
  const mine = useQuery(api.propertyAssignments.listMine) as AssignedProperty[] | undefined;
  const jobs = useQuery(api.jobs.listMyUpcoming, {
    from: startOfToday(),
    to: startOfToday() + 14 * DAY_MS,
  }) as ScheduleJob[] | undefined;

  // Admin-only queries (skip for workers)
  const adminStats = useQuery(
    api.admin.stats,
    isAdmin ? undefined : "skip"
  ) as AdminStats | undefined;
  const adminDispatch = useQuery(
    api.jobs.listAdminDispatch,
    isAdmin ? { from: startOfToday(), to: startOfToday() + 7 * DAY_MS } : "skip"
  ) as AdminDispatchJob[] | undefined;
  const allStaff = useQuery(
    api.users.listActiveStaff,
    isAdmin ? undefined : "skip"
  ) as StaffUser[] | undefined;

  const todayJobs = (jobs ?? []).filter(
    (job) => job.scheduledStart >= startOfToday() && job.scheduledStart <= endOfToday()
  );
  const nextChecklistJobs = (jobs ?? [])
    .filter((job) => job.checklistType !== null && job.status !== "COMPLETED" && job.status !== "CANCELLED")
    .sort((left, right) => {
      const rankDelta = workerChecklistRank(left) - workerChecklistRank(right);
      return rankDelta !== 0 ? rankDelta : left.scheduledStart - right.scheduledStart;
    })
    .slice(0, 3);
  const nextJob = nextChecklistJobs[0] ?? null;

  if (isAdmin) {
    const adminTodayJobs = (adminDispatch ?? [])
      .filter((job) => job.scheduledStart >= startOfToday() && job.scheduledStart <= endOfToday())
      .sort((left, right) => left.scheduledStart - right.scheduledStart);
    const unassignedToday = adminTodayJobs.filter((job) => !job.assigneeId);
    const blockedToday = adminTodayJobs.filter((job) => job.status === "BLOCKED");
    const inProgressToday = adminTodayJobs.filter((job) => job.status === "IN_PROGRESS");
    const needsAttention = [
      ...unassignedToday,
      ...blockedToday.filter((job) => job.assigneeId),
    ];

    const activeStaff = (allStaff ?? []).filter((member) => member.isActive);
    const staffWithCounts = activeStaff
      .map((member) => {
        const memberJobs = adminTodayJobs.filter((job) => job.assigneeId === member._id);
        return {
          ...member,
          todayJobCount: memberJobs.length,
          inProgressCount: memberJobs.filter((job) => job.status === "IN_PROGRESS").length,
        };
      })
      .sort((left, right) => right.todayJobCount - left.todayJobCount);

    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfToday() + index * DAY_MS);
      const dayJobs = (adminDispatch ?? []).filter((job) => {
        const jobDate = new Date(job.scheduledStart);
        return (
          jobDate.getFullYear() === date.getFullYear() &&
          jobDate.getMonth() === date.getMonth() &&
          jobDate.getDate() === date.getDate()
        );
      });
      return { date, jobs: dayJobs };
    });
    const maxJobsInDay = Math.max(1, ...weekDays.map((day) => day.jobs.length));

    return (
      <div className="animate-fade-in space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Command Center
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {user?.name ? `Hi, ${user.name}` : "Welcome"}
            </h1>
          </div>
          <p className="text-sm font-medium text-slate-500">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* ── KPI pills ── */}
        <section className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">
            {adminTodayJobs.length} jobs today
          </span>
          {inProgressToday.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              {inProgressToday.length} in progress
            </span>
          )}
          {unassignedToday.length > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
              {unassignedToday.length} unassigned
            </span>
          )}
          {blockedToday.length > 0 && (
            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">
              {blockedToday.length} blocked
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            {adminStats?.activeProperties ?? "..."} properties
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            {activeStaff.length} staff
          </span>
        </section>

        {/* ── Needs Attention (unassigned + blocked) ── */}
        {needsAttention.length > 0 && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold text-amber-900">Needs Attention</h2>
              <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                {needsAttention.length}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {needsAttention.slice(0, 6).map((job) => (
                <div
                  key={job._id}
                  className="rounded-xl border border-amber-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {job.propertyName}
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(job.scheduledStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {job.jobType}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        !job.assigneeId
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : statusTone(job.status)
                      }`}
                    >
                      {!job.assigneeId ? "UNASSIGNED" : job.status}
                    </span>
                  </div>
                  <Link
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                    to="/schedule"
                  >
                    Open in Dispatch <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Today's Operations + Staff On Duty ── */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
          {/* Today's Timeline */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="min-w-0 text-lg font-bold">Today&apos;s Operations</h2>
              <Link
                className="shrink-0 whitespace-nowrap text-xs font-semibold text-brand-700 hover:text-brand-800"
                to="/schedule"
              >
                Full Dispatch &rarr;
              </Link>
            </div>
            {adminDispatch === undefined ? (
              <div className="space-y-2">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : adminTodayJobs.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                heading="No jobs scheduled today"
                description="Create jobs in dispatch or check the week ahead view."
              />
            ) : (
              <div className="space-y-1.5">
                {adminTodayJobs.map((job) => (
                  <Link
                    key={job._id}
                    className="flex items-center gap-2 rounded-xl border border-border p-2 transition hover:border-brand-300 sm:gap-3 sm:p-3"
                    to="/schedule"
                  >
                    <div className="w-12 shrink-0 text-center sm:w-14">
                      <p className="text-xs font-bold text-slate-900 sm:text-sm">
                        {new Date(job.scheduledStart).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {job.propertyName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {job.jobType}
                        {job.assigneeName
                          ? ` · ${job.assigneeName}`
                          : ""}
                      </p>
                    </div>
                    {!job.assigneeId ? (
                      <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        OPEN
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Staff On Duty */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="min-w-0 text-lg font-bold">Staff Roster</h2>
              <Link
                className="shrink-0 whitespace-nowrap text-xs font-semibold text-brand-700 hover:text-brand-800"
                to="/admin"
              >
                Manage &rarr;
              </Link>
            </div>
            {allStaff === undefined ? (
              <div className="space-y-2">
                <div className="skeleton h-14 rounded-xl" />
                <div className="skeleton h-14 rounded-xl" />
                <div className="skeleton h-14 rounded-xl" />
              </div>
            ) : activeStaff.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                heading="No active staff"
                description="Add cleaners and inspectors in staff management."
              />
            ) : (
              <div className="space-y-1.5">
                {staffWithCounts.map((member) => (
                  <div
                    key={member._id}
                    className="flex items-center gap-2 rounded-xl border border-border p-2 sm:gap-3 sm:p-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white sm:h-9 sm:w-9 sm:text-xs ${
                        member.role === "CLEANER"
                          ? "bg-brand-500"
                          : "bg-accent-500"
                      }`}
                    >
                      {member.name
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">{member.role}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {member.todayJobCount === 0 ? (
                        <span className="text-xs text-slate-400">idle</span>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-900">
                            {member.todayJobCount} job{member.todayJobCount === 1 ? "" : "s"}
                          </p>
                          {member.inProgressCount > 0 && (
                            <p className="text-[11px] text-emerald-600">
                              {member.inProgressCount} active
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Week Ahead ── */}
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Week Ahead</h2>
            <Link
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              to="/schedule"
            >
              Open Dispatch &rarr;
            </Link>
          </div>
          {adminDispatch === undefined ? (
            <div className="flex gap-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex-1">
                  <div className="skeleton mx-auto h-16 w-10 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(({ date, jobs: dayJobs }) => {
                const isToday =
                  date.getFullYear() === new Date().getFullYear() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getDate() === new Date().getDate();
                const barHeight = Math.max(6, (dayJobs.length / maxJobsInDay) * 64);
                const hasUnassigned = dayJobs.some((job) => !job.assigneeId);
                return (
                  <div key={date.toISOString()} className="text-center">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-[0.1em] ${
                        isToday ? "text-brand-700" : "text-slate-400"
                      }`}
                    >
                      {date.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <div className="mx-auto mt-1.5 flex h-16 items-end justify-center">
                      <div
                        className={`w-9 rounded-t-lg transition-all ${
                          hasUnassigned
                            ? "bg-amber-400"
                            : isToday
                              ? "bg-brand-500"
                              : "bg-brand-200"
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                    <p
                      className={`mt-1 text-sm font-bold ${
                        isToday ? "text-brand-700" : "text-slate-700"
                      }`}
                    >
                      {dayJobs.length}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Active Checklists ── */}
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Active Checklists</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {active?.length ?? "..."} running
            </span>
          </div>
          {active === undefined ? (
            <div className="space-y-2">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : active.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              heading="No checklists running"
              description="Active checklists appear here when staff starts working on them."
            />
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {active.map((inspection) => (
                <Link
                  key={inspection._id}
                  className="rounded-xl border border-border p-3 transition hover:border-brand-300"
                  to={`/checklists/${inspection._id}`}
                >
                  <p className="font-semibold">{inspection.propertyName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {inspection.type} · {inspection.status}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Actions ── */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            icon={<CalendarDays className="h-5 w-5" />}
            label="Dispatch Schedule"
            description="Assign jobs and manage the calendar"
            to="/schedule"
          />
          <QuickAction
            icon={<Building2 className="h-5 w-5" />}
            label="Properties"
            description="Manage properties and service plans"
            to="/admin/properties"
          />
          <QuickAction
            icon={<Users className="h-5 w-5" />}
            label="Staff"
            description="Manage cleaners and inspectors"
            to="/admin"
          />
          <QuickAction
            icon={<LayoutTemplate className="h-5 w-5" />}
            label="Templates"
            description="Edit room and task templates"
            to="/admin/templates"
          />
        </section>
      </div>
    );
  }

  const copy = isCleaner
    ? {
        heroDescription:
          "Start from your next clean, then use the schedule snapshot to see the rest of your day.",
        nextEyebrow: "Up Next",
        nextEmptyHeading: "No cleans lined up yet",
        nextEmptyDescription:
          "When your next clean is ready to start, it will show up here.",
        primaryAction: "Resume Checklist",
        secondaryAction: "Open In Schedule",
        scheduleEyebrow: "Clean Snapshot",
        scheduleSummary: `${todayJobs.length} clean${todayJobs.length === 1 ? "" : "s"} scheduled today.`,
        scheduleEmptyHeading: "No cleans today",
        scheduleEmptyDescription: "Take a breather. Your next assigned clean will show up in the schedule.",
        activeHeading: "Active Checklists",
        activeEmptyHeading: "No active checklists",
        activeEmptyDescription: "Start from My Schedule when your next clean is ready.",
        activeCta: "Open Checklist",
        nextButterflyHeading: "No cleans waiting",
      }
    : {
        heroDescription:
          "Start from your next inspection job, then use the schedule snapshot to see the rest of your jobs.",
        nextEyebrow: "Up Next",
        nextEmptyHeading: "No inspection jobs lined up yet",
        nextEmptyDescription:
          "Your next inspection job will show up here when it is ready to work.",
        primaryAction: "Resume Inspection",
        secondaryAction: "Open Job In Schedule",
        scheduleEyebrow: "Inspection Snapshot",
        scheduleSummary: `${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} scheduled today.`,
        scheduleEmptyHeading: "No inspections today",
        scheduleEmptyDescription: "You are clear for now. Check the schedule for upcoming jobs later this week.",
        activeHeading: "Active Inspections",
        activeEmptyHeading: "No active inspections",
        activeEmptyDescription: "Start from My Schedule when your next inspection job is ready.",
        activeCta: "Open Inspection",
        nextButterflyHeading: "No inspection jobs waiting",
      };

  return (
    <div className="animate-fade-in space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Welcome Back
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          {user?.name ? `Hi, ${user.name}` : "Welcome"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.heroDescription}</p>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {copy.nextEyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {nextJob ? nextJob.propertyName : copy.nextEmptyHeading}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {nextJob
                  ? `${nextJob.jobType} scheduled ${formatJobWindow(nextJob)}`
                  : copy.nextEmptyDescription}
              </p>
            </div>
            <ClipboardList className="h-6 w-6 text-brand-700" />
          </div>

          {nextChecklistJobs.length === 0 ? (
            <div className="mt-4">
              <ButterflyEmptyState
                description={copy.nextEmptyDescription}
                heading={copy.nextButterflyHeading}
                eyebrow={copy.nextEyebrow}
                action={
                  <Link className="field-button primary px-5" to="/my-schedule">
                    View Schedule
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {nextChecklistJobs.map((job, index) => (
                <div
                  key={job._id}
                  className={`rounded-2xl border p-4 ${
                    index === 0 ? "border-brand-300 bg-brand-50" : "border-border bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{job.propertyName}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatJobWindow(job)}</p>
                      <p className="mt-1 text-sm text-slate-500">{job.propertyAddress}</p>
                    </div>
                    <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {job.linkedInspectionId ? "Resume Ready" : job.canStartChecklist ? "Start Ready" : job.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.linkedInspectionId ? (
                      <Link className="field-button primary px-4" to={`/checklists/${job.linkedInspectionId}`}>
                        {copy.primaryAction}
                      </Link>
                    ) : (
                      <Link className="field-button primary px-4" to="/my-schedule">
                        {copy.secondaryAction}
                      </Link>
                    )}
                    <Link className="field-button secondary px-4" to="/my-schedule">
                      View Schedule
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {copy.scheduleEyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold">Today</h2>
              <p className="mt-2 text-sm text-slate-600">{copy.scheduleSummary}</p>
            </div>
            <CalendarDays className="h-6 w-6 text-brand-700" />
          </div>

          {jobs === undefined ? (
            <div className="mt-4 space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : todayJobs.length === 0 ? (
            <div className="mt-4">
              <ButterflyEmptyState
                animated
                description={copy.scheduleEmptyDescription}
                heading={copy.scheduleEmptyHeading}
                eyebrow={copy.scheduleEyebrow}
                action={
                  <Link className="field-button secondary px-5" to="/my-schedule">
                    View Full Schedule
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {todayJobs.slice(0, 3).map((job) => (
                <div key={job._id} className="rounded-2xl border border-border bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock3 className="h-4 w-4" />
                    <span>{formatJobWindow(job)}</span>
                  </div>
                  <p className="mt-2 font-semibold">{job.propertyName}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <span>{job.propertyAddress}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link className="field-button secondary mt-4 w-full px-4" to="/my-schedule">
            View Full Schedule
          </Link>
        </div>
      </section>

      {!isOnline ? (
        <OfflineQueuePanel
          description="Field actions queue locally and replay when the device reconnects."
          items={items}
          title="Offline Outbox"
        />
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">{copy.activeHeading}</h2>
        {active === undefined ? (
          <div className="space-y-3">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
          </div>
        ) : active.length === 0 ? (
          <ButterflyEmptyState
            description={copy.activeEmptyDescription}
            heading={copy.activeEmptyHeading}
            eyebrow={copy.activeHeading}
            action={
              <Link className="field-button primary px-5" to="/my-schedule">
                Go To My Schedule
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {active.map((inspection) => (
              <Link
                key={inspection._id}
                className="block rounded-xl border border-border p-3 transition hover:border-brand-400"
                to={`/checklists/${inspection._id}`}
              >
                <p className="font-semibold">{inspection.propertyName}</p>
                <p className="text-sm text-slate-500">
                  {inspection.type} | {inspection.status}
                </p>
                <span className="mt-2 inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {copy.activeCta}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isInspector ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <h2 className="mb-2 text-lg font-bold">Assigned Properties</h2>
          {mine === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              heading="No properties assigned yet"
              description="An admin needs to assign you to one or more properties before they appear here."
            />
          ) : (
            <div className="space-y-2">
              {mine.slice(0, 4).map((assignment) => (
                <div key={assignment._id} className="rounded-xl border border-border p-3">
                  <p className="font-semibold">{assignment.property?.name ?? "Unknown property"}</p>
                  <p className="text-sm text-slate-500">{assignment.property?.address ?? ""}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  description,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
      to={to}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}
