import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

type InvoiceFinanceSummary = {
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonthAmount: number;
  openCount: number;
  overdueCount: number;
  draftCount: number;
};

type FinanceJob = {
  jobId: Id<"jobs">;
  inspectionId?: Id<"inspections">;
  propertyId: Id<"properties">;
  propertyName: string;
  clientLabel?: string;
  assigneeId?: Id<"users">;
  assigneeName: string;
  assigneeNames?: string[];
  assignmentCount?: number;
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
    assignmentCount?: number;
  }>;
};

type ClientSummary = {
  clientLabel: string;
  forecastRevenue: number;
  pendingReviewRevenue: number;
  realizedRevenue: number;
  approvedPayroll: number;
  grossMargin: number;
  jobs: FinanceJob[];
};

type FinanceTab = "overview" | "payroll" | "revenue" | "clients" | "jobs";

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

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date: Date) {
  const next = startOfDay(date);
  next.setDate(1);
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

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function formatWorkerLabel(job: Pick<FinanceJob, "assigneeName" | "assigneeNames">) {
  return job.assigneeNames && job.assigneeNames.length > 0
    ? job.assigneeNames.map(firstName).join(" + ")
    : firstName(job.assigneeName);
}

export function FinancePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [rangeFrom, setRangeFrom] = useState(toDateInputValue(addDays(today, -14)));
  const [rangeTo, setRangeTo] = useState(toDateInputValue(addDays(today, 30)));
  const [payrollPeriod, setPayrollPeriod] = useState<"WEEK" | "MONTH">("WEEK");
  const [payrollAnchor, setPayrollAnchor] = useState(getThursday(today).getTime());
  const [collapsedPayees, setCollapsedPayees] = useState<Record<string, boolean>>({});

  const fromTimestamp = parseDateInputValue(rangeFrom, addDays(today, -14));
  const toTimestamp = parseDateInputValue(rangeTo, addDays(today, 30)) + 24 * 60 * 60 * 1000 - 1;
  const payrollPeriodStart =
    payrollPeriod === "WEEK"
      ? getThursday(new Date(payrollAnchor)).getTime()
      : startOfMonth(new Date(payrollAnchor)).getTime();
  const payrollPeriodEnd =
    payrollPeriod === "WEEK"
      ? addDays(new Date(payrollPeriodStart), 7).getTime()
      : addMonths(new Date(payrollPeriodStart), 1).getTime();

  const overview = useQuery(api.finance.getOverview, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as FinanceOverview | undefined;
  const invoiceSummary = useQuery(api.invoices.getFinanceSummary, {}) as
    | InvoiceFinanceSummary
    | undefined;
  const jobs = useQuery(api.finance.listJobs, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as FinanceJob[] | undefined;
  const revenue = useQuery(api.finance.listRevenue, {
    from: fromTimestamp,
    to: toTimestamp,
  }) as RevenueSummary[] | undefined;
  const payroll = useQuery(api.finance.listPayroll, {
    weekStart: payrollPeriodStart,
    periodEnd: payrollPeriodEnd,
  }) as PayrollWorker[] | undefined;

  function movePayrollPeriod(direction: -1 | 1) {
    const anchor = new Date(payrollPeriodStart);
    const next = payrollPeriod === "WEEK" ? addDays(anchor, direction * 7) : addMonths(anchor, direction);
    setPayrollAnchor(next.getTime());
  }

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
  const clientSummaries = useMemo(() => {
    const summaries = new Map<string, ClientSummary>();

    for (const job of jobs ?? []) {
      const clientLabel = job.clientLabel?.trim() || "No client label";
      const existing = summaries.get(clientLabel) ?? {
        clientLabel,
        forecastRevenue: 0,
        pendingReviewRevenue: 0,
        realizedRevenue: 0,
        approvedPayroll: 0,
        grossMargin: 0,
        jobs: [],
      };

      if (job.financeStatus === "APPROVED") {
        existing.realizedRevenue += job.revenueAmount ?? 0;
        existing.approvedPayroll += job.payrollAmount ?? 0;
        existing.grossMargin += job.grossMargin ?? 0;
      } else if (job.jobStatus === "COMPLETED") {
        existing.pendingReviewRevenue += job.revenueAmount ?? 0;
      } else {
        existing.forecastRevenue += job.revenueAmount ?? 0;
      }

      existing.jobs.push(job);
      summaries.set(clientLabel, existing);
    }

    return Array.from(summaries.values())
      .map((summary) => ({
        ...summary,
        forecastRevenue: Math.round(summary.forecastRevenue * 100) / 100,
        pendingReviewRevenue: Math.round(summary.pendingReviewRevenue * 100) / 100,
        realizedRevenue: Math.round(summary.realizedRevenue * 100) / 100,
        approvedPayroll: Math.round(summary.approvedPayroll * 100) / 100,
        grossMargin: Math.round(summary.grossMargin * 100) / 100,
        jobs: summary.jobs.sort((left, right) => right.scheduledStart - left.scheduledStart),
      }))
      .sort((left, right) => right.realizedRevenue - left.realizedRevenue);
  }, [jobs]);

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
        <div className="grid gap-2 sm:grid-cols-2">
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
            ["clients", "Clients"],
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
              <OverviewStat label="Outstanding Invoices" value={formatCurrency(invoiceSummary?.outstandingAmount)} />
              <OverviewStat label="Collected This Month" value={formatCurrency(invoiceSummary?.paidThisMonthAmount)} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-lg font-bold">Action Queue</h2>
            <div className="mt-3 space-y-3 text-sm">
              <QueueRow label="Pending review" value={String(pendingReviewJobs.length)} />
              <QueueRow label="Forecast jobs" value={String(forecastJobs.length)} />
              <QueueRow label="Approved jobs" value={String(approvedJobs.length)} />
              <QueueRow label="Invoice drafts" value={String(invoiceSummary?.draftCount ?? 0)} />
              <QueueRow label="Open invoices" value={String(invoiceSummary?.openCount ?? 0)} />
              <QueueRow label="Overdue invoices" value={String(invoiceSummary?.overdueCount ?? 0)} />
              <Link className="field-button secondary mt-2 w-full justify-center px-4" to="/history">
                Open History Review
              </Link>
              <Link className="field-button primary mt-2 w-full justify-center px-4" to="/invoices">
                <ReceiptText className="mr-2 h-4 w-4" />
                Open Invoices
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "payroll" ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                {payrollPeriod === "WEEK" ? "Weekly Payroll" : "Monthly Payroll"}
              </h2>
              <p className="text-sm text-slate-600">
                Approved cleaning jobs only. Weekly periods run Thursday through Wednesday.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1">
                {(["WEEK", "MONTH"] as const).map((period) => (
                  <button
                    key={period}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      payrollPeriod === period ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
                    }`}
                    onClick={() => {
                      setPayrollPeriod(period);
                      setPayrollAnchor(
                        period === "WEEK"
                          ? getThursday(new Date()).getTime()
                          : startOfMonth(new Date()).getTime()
                      );
                    }}
                    type="button"
                  >
                    {period === "WEEK" ? "By Week" : "By Month"}
                  </button>
                ))}
              </div>
              <button
                aria-label={`Previous payroll ${payrollPeriod.toLowerCase()}`}
                className="field-button secondary px-3"
                onClick={() => movePayrollPeriod(-1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-40 text-center text-sm font-semibold text-slate-700">
                {payrollPeriod === "WEEK"
                  ? `${new Date(payrollPeriodStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(payrollPeriodEnd - 1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : new Date(payrollPeriodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button
                aria-label={`Next payroll ${payrollPeriod.toLowerCase()}`}
                className="field-button secondary px-3"
                disabled={payrollPeriodEnd > Date.now()}
                onClick={() => movePayrollPeriod(1)}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
                      <p className="font-semibold">{firstName(worker.assigneeName)}</p>
                      <p className="text-sm text-slate-600">
                        Payroll {formatCurrency(worker.totalPayroll)} | Revenue {formatCurrency(worker.totalRevenue)} | Gross {formatCurrency(worker.grossMargin)}
                      </p>
                    </div>
                    <button
                      aria-expanded={!collapsedPayees[worker.assigneeId]}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
                      onClick={() =>
                        setCollapsedPayees((current) => ({
                          ...current,
                          [worker.assigneeId]: !current[worker.assigneeId],
                        }))
                      }
                      type="button"
                    >
                      {worker.jobs.length} approved job{worker.jobs.length === 1 ? "" : "s"}
                      {collapsedPayees[worker.assigneeId] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {!collapsedPayees[worker.assigneeId] ? <div className="mt-3 space-y-2">
                    {worker.jobs.map((job) => (
                      <div key={job.jobId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{job.propertyName}</p>
                          <p className="text-slate-500">{formatPerformedDate(job.completedAt)}</p>
                          <p className="text-slate-500">
                            {job.roomComboUnits ?? "--"} combos x {formatCurrency(job.perRoomComboRate)} + {formatCurrency(job.unitBonus)}
                          </p>
                          {(job.assignmentCount ?? 1) > 1 ? (
                            <p className="text-xs font-semibold text-brand-700">
                              Split {job.assignmentCount} ways
                            </p>
                          ) : null}
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
                  </div> : null}
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

      {activeTab === "clients" ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Revenue And Jobs By Client</h2>
            <p className="text-sm text-slate-600">Client rollups use the client label saved on each property.</p>
          </div>
          {jobs === undefined ? (
            <div className="space-y-3">
              <div className="skeleton h-20 rounded-2xl" />
              <div className="skeleton h-20 rounded-2xl" />
            </div>
          ) : clientSummaries.length === 0 ? (
            <p className="text-sm text-slate-500">No client revenue or jobs in this date window.</p>
          ) : (
            <div className="space-y-3">
              {clientSummaries.map((client) => (
                <div key={client.clientLabel} className="rounded-2xl border border-border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{client.clientLabel}</p>
                      <p className="text-sm text-slate-600">
                        {client.jobs.length} cleaning job{client.jobs.length === 1 ? "" : "s"} in range
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-right text-sm md:grid-cols-4">
                      <RevenueCell label="Forecast" value={formatCurrency(client.forecastRevenue)} />
                      <RevenueCell label="Pending" value={formatCurrency(client.pendingReviewRevenue)} />
                      <RevenueCell label="Realized" value={formatCurrency(client.realizedRevenue)} />
                      <RevenueCell label="Gross" value={formatCurrency(client.grossMargin)} />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {client.jobs.map((job) => (
                      <div key={job.jobId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{job.propertyName}</p>
                          <p className="text-slate-500">
                            {formatWorkerLabel(job)} | {new Date(job.scheduledStart).toLocaleString()} | {job.jobStatus}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(job.revenueAmount)}</p>
                          <p className="text-xs text-slate-500">{job.financeStatus}</p>
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
                        {formatWorkerLabel(job)} | {new Date(job.scheduledStart).toLocaleString()} | {job.jobStatus}
                      </p>
                      {(job.assignmentCount ?? 1) > 1 ? (
                        <p className="text-xs font-semibold text-brand-700">
                          Payroll split {job.assignmentCount} ways
                        </p>
                      ) : null}
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

