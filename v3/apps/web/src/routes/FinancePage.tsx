import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Calculator, DollarSign, TrendingUp, Wallet } from "lucide-react";

type FinanceOverview = {
  forecastRevenue: number;
  upcomingForecastRevenue: number;
  pendingReviewRevenue: number;
  realizedRevenue: number;
  approvedPayroll: number;
  grossMargin: number;
  pendingReviewCount: number;
  totalCleaningJobs: number;
};

type FinanceJob = {
  jobId: Id<"jobs">;
  inspectionId?: Id<"inspections">;
  propertyId: Id<"properties">;
  propertyName: string;
  clientLabel?: string;
  assigneeId?: Id<"users">;
  assigneeName: string;
  scheduledStart: number;
  completedAt?: number;
  jobStatus: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
  financeStatus: "FORECAST" | "PENDING_REVIEW" | "APPROVED";
  revenueAmount?: number;
  roomComboUnits?: number;
  perRoomComboRate?: number;
  unitBonus?: number;
  payrollAmount?: number;
  grossMargin?: number;
  missingFields: string[];
  warnings: string[];
  approvedAt?: number;
  hasSavedDraft: boolean;
};

type RevenueSummary = {
  propertyId: Id<"properties">;
  propertyName: string;
  forecastRevenue: number;
  pendingReviewRevenue: number;
  realizedRevenue: number;
  approvedPayroll: number;
  grossMargin: number;
  jobCount: number;
};

type PayrollWorker = {
  assigneeId: Id<"users">;
  assigneeName: string;
  totalPayroll: number;
  totalRevenue: number;
  grossMargin: number;
  jobs: Array<{
    jobId: Id<"jobs">;
    inspectionId?: Id<"inspections">;
    propertyName: string;
    completedAt?: number;
    roomComboUnits?: number;
    perRoomComboRate?: number;
    unitBonus?: number;
    payrollAmount?: number;
    revenueAmount?: number;
  }>;
};

type FinanceTab = "overview" | "payroll" | "revenue" | "jobs";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getThursday(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const distance = day >= 4 ? 4 - day : -(day + 3);
  next.setDate(next.getDate() + distance);
  return next;
}

function formatPerformedDate(timestamp?: number) {
  if (!timestamp) {
    return "Performed date unavailable";
  }

  return `Performed ${new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInputValue(value: string, fallback: Date) {
  if (!value) {
    return fallback.getTime();
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback.getTime() : parsed.getTime();
}

function formatCurrency(value?: number) {
  if (value === undefined) {
    return "--";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function statusTone(status: FinanceJob["financeStatus"]) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "PENDING_REVIEW":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-brand-100 text-brand-700";
  }
}

export function FinancePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [rangeFrom, setRangeFrom] = useState(toDateInputValue(addDays(today, -14)));
  const [rangeTo, setRangeTo] = useState(toDateInputValue(addDays(today, 30)));
  const [payrollWeekStart, setPayrollWeekStart] = useState(toDateInputValue(getThursday(today)));

  const fromTimestamp = parseDateInputValue(rangeFrom, addDays(today, -14));
  const toTimestamp = parseDateInputValue(rangeTo, addDays(today, 30)) + 24 * 60 * 60 * 1000 - 1;
  const payrollWeekStartTimestamp = parseDateInputValue(payrollWeekStart, getThursday(today));

  const overview = useQuery(api.finance.getOverview, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as FinanceOverview | undefined;
  const jobs = useQuery(api.finance.listJobs, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as FinanceJob[] | undefined;
  const revenue = useQuery(api.finance.listRevenue, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as RevenueSummary[] | undefined;
  const payroll = useQuery(api.finance.listPayroll, {
    weekStart: payrollWeekStartTimestamp,
  }) as PayrollWorker[] | undefined;

  const pendingReviewJobs = useMemo(
    () => (jobs ?? []).filter((job) => job.financeStatus === "PENDING_REVIEW"),
    [jobs]
  );
  const approvedJobs = useMemo(
    () => (jobs ?? []).filter((job) => job.financeStatus === "APPROVED"),
    [jobs]
  );
  const forecastJobs = useMemo(
    () => (jobs ?? []).filter((job) => job.financeStatus === "FORECAST"),
    [jobs]
  );

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Finance</p>
          <h1 className="mt-1 text-2xl font-bold">Payroll, Revenue, and Job Economics</h1>
          <p className="text-sm text-slate-600">
            Finance stays admin-only and builds directly on completed cleaning jobs and admin approval.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              className="input mt-1"
              onChange={(event) => setRangeFrom(event.target.value)}
              type="date"
              value={rangeFrom}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              className="input mt-1"
              onChange={(event) => setRangeTo(event.target.value)}
              type="date"
              value={rangeTo}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Payroll Week
            <input
              className="input mt-1"
              onChange={(event) => setPayrollWeekStart(event.target.value)}
              type="date"
              value={payrollWeekStart}
            />
          </label>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Forecast Revenue" value={formatCurrency(overview?.forecastRevenue)} />
        <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Pending Review" value={formatCurrency(overview?.pendingReviewRevenue)} />
        <MetricCard icon={<Wallet className="h-5 w-5" />} label="Realized Revenue" value={formatCurrency(overview?.realizedRevenue)} />
        <MetricCard icon={<Calculator className="h-5 w-5" />} label="Approved Payroll" value={formatCurrency(overview?.approvedPayroll)} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {([
            ["overview", "Overview"],
            ["payroll", "Payroll"],
            ["revenue", "Revenue"],
            ["jobs", "Jobs"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === tab ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white p-4 xl:col-span-2">
            <h2 className="text-lg font-bold">Finance Health</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <OverviewStat label="Upcoming Scheduled Forecast" value={formatCurrency(overview?.upcomingForecastRevenue)} />
              <OverviewStat label="Pending Review Jobs" value={String(overview?.pendingReviewCount ?? 0)} />
              <OverviewStat label="Realized Gross Margin" value={formatCurrency(overview?.grossMargin)} />
              <OverviewStat label="Cleaning Jobs In Window" value={String(overview?.totalCleaningJobs ?? 0)} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-lg font-bold">Action Queue</h2>
            <div className="mt-3 space-y-3 text-sm">
              <QueueRow label="Pending review" value={String(pendingReviewJobs.length)} />
              <QueueRow label="Forecast jobs" value={String(forecastJobs.length)} />
              <QueueRow label="Approved jobs" value={String(approvedJobs.length)} />
              <Link className="field-button secondary mt-2 w-full justify-center px-4" to="/history">
                Open History Review
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "payroll" ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Weekly Payroll</h2>
            <p className="text-sm text-slate-600">Approved cleaning jobs only. Weeks run Thursday through Wednesday.</p>
          </div>
          {payroll === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-20 rounded-2xl" />
              <div className="skeleton h-20 rounded-2xl" />
            </div>
          ) : payroll.length === 0 ? (
            <p className="text-sm text-slate-500">No approved payroll jobs landed in this week yet.</p>
          ) : (
            <div className="space-y-3">
              {payroll.map((worker) => (
                <div key={worker.assigneeId} className="rounded-2xl border border-border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{worker.assigneeName}</p>
                      <p className="text-sm text-slate-600">
                        Payroll {formatCurrency(worker.totalPayroll)} | Revenue {formatCurrency(worker.totalRevenue)} | Gross {formatCurrency(worker.grossMargin)}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                      {worker.jobs.length} approved job{worker.jobs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {worker.jobs.map((job) => (
                      <div key={job.jobId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{job.propertyName}</p>
                          <p className="text-slate-500">{formatPerformedDate(job.completedAt)}</p>
                          <p className="text-slate-500">
                            {job.roomComboUnits ?? "--"} combos x {formatCurrency(job.perRoomComboRate)} + {formatCurrency(job.unitBonus)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(job.payrollAmount)}</p>
                          {job.inspectionId ? (
                            <Link className="text-xs font-semibold text-brand-700 underline" to={`/checklists/${job.inspectionId}`}>
                              Open review
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "revenue" ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Revenue By Property</h2>
            <p className="text-sm text-slate-600">Forecasted, pending-review, and realized revenue for cleaning jobs.</p>
          </div>
          {revenue === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-2">
              {revenue.map((row) => (
                <div key={row.propertyId} className="grid gap-3 rounded-2xl border border-border bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,140px))]">
                  <div>
                    <p className="font-semibold">{row.propertyName}</p>
                    <p className="text-sm text-slate-500">{row.jobCount} cleaning job{row.jobCount === 1 ? "" : "s"} in range</p>
                  </div>
                  <RevenueCell label="Forecast" value={formatCurrency(row.forecastRevenue)} />
                  <RevenueCell label="Pending" value={formatCurrency(row.pendingReviewRevenue)} />
                  <RevenueCell label="Realized" value={formatCurrency(row.realizedRevenue)} />
                  <RevenueCell label="Gross" value={formatCurrency(row.grossMargin)} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "jobs" ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Finance Job Tracker</h2>
            <p className="text-sm text-slate-600">Review the financial state of each cleaning job in the selected date window.</p>
          </div>
          {jobs === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.jobId} className="rounded-2xl border border-border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{job.propertyName}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(job.financeStatus)}`}>
                          {job.financeStatus}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {job.assigneeName} | {new Date(job.scheduledStart).toLocaleString()} | {job.jobStatus}
                      </p>
                      {job.clientLabel ? (
                        <p className="text-xs font-semibold text-brand-700">Client: {job.clientLabel}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">Revenue {formatCurrency(job.revenueAmount)}</p>
                      <p className="text-slate-600">Payroll {formatCurrency(job.payrollAmount)}</p>
                      <p className="text-slate-600">Gross {formatCurrency(job.grossMargin)}</p>
                      {job.inspectionId ? (
                        <Link className="mt-2 inline-block text-xs font-semibold text-brand-700 underline" to={`/checklists/${job.inspectionId}`}>
                          Open job review
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {job.missingFields.length > 0 ? (
                    <p className="mt-2 text-xs text-rose-700">Missing: {job.missingFields.join(", ")}</p>
                  ) : null}
                  {job.warnings.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-700">{job.warnings.join(" ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-brand-700">{icon}<span className="text-sm font-semibold">{label}</span></div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function QueueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-3 py-2">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function RevenueCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

