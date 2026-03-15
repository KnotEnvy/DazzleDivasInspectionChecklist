import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Building2, CalendarDays, ClipboardList, Clock3, MapPin } from "lucide-react";
import { ButterflyEmptyState } from "@/components/ButterflyEmptyState";
import { EmptyState } from "@/components/EmptyState";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
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
    return (
      <div className="animate-fade-in space-y-5">
        <section className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Welcome Back
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {user?.name ? `Hi, ${user.name}` : "Welcome"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use this dashboard to monitor active checklist work and assigned properties.
          </p>
        </section>

        {!isOnline ? (
          <OfflineQueuePanel
            description="Field actions queue locally and replay when the device reconnects."
            items={items}
            title="Offline Outbox"
          />
        ) : null}

        <section className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm text-slate-500">Current role</p>
            <p className="text-xl font-bold">{user?.role ?? "Loading..."}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm text-slate-500">Active checklists</p>
            <p className="text-xl font-bold">{active?.length ?? "..."}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm text-slate-500">Assigned properties</p>
            <p className="text-xl font-bold">{mine?.length ?? "..."}</p>
          </div>
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
