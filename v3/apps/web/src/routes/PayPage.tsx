import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Layers3,
  Printer,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  filterCalendarYear,
  getPayHistoryQueryRange,
  groupPayByMonth,
  groupPayByWeek,
  summarizePay,
  type PayPeriod,
  type PaySummary,
  type WorkerPayHistory,
} from "@/lib/payHistory";

type PayView = "WEEKLY" | "MONTHLY" | "YTD";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatHours(value: number) {
  return `${formatNumber(value)} hrs`;
}

function formatActualHours(summary: PaySummary) {
  return summary.actualHoursJobCount > 0 ? formatHours(summary.totalActualHoursWorked) : "Not recorded";
}

function formatActualHourlyWage(summary: PaySummary) {
  return summary.actualHoursJobCount > 0 ? formatCurrency(summary.actualHourlyWage) : "Not available";
}

function actualHoursCoverage(summary: PaySummary) {
  if (summary.missingActualHoursJobCount === 0) {
    return "All approved jobs included";
  }

  return `${summary.actualHoursJobCount} of ${summary.jobCount} jobs included`;
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeek(period: PayPeriod) {
  return `${formatDate(period.periodStart)} - ${formatDate(period.periodEnd - 1)}`;
}

export function PayPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeView, setActiveView] = useState<PayView>("WEEKLY");
  const range = useMemo(() => getPayHistoryQueryRange(selectedYear), [selectedYear]);
  const history = useQuery(api.finance.getMyPayHistory, {
    from: range.queryFrom,
    to: range.queryTo,
  }) as WorkerPayHistory | undefined;

  const calendarYearEntries = useMemo(
    () => filterCalendarYear(history?.entries ?? [], range.yearStart, range.nextYearStart),
    [history, range.nextYearStart, range.yearStart]
  );
  const weeklyPeriods = useMemo(
    () =>
      groupPayByWeek(history?.entries ?? []).filter(
        (period) => period.periodStart < range.nextYearStart && period.periodEnd > range.yearStart
      ),
    [history, range.nextYearStart, range.yearStart]
  );
  const monthlyPeriods = useMemo(() => groupPayByMonth(calendarYearEntries), [calendarYearEntries]);
  const yearSummary = useMemo(() => summarizePay(calendarYearEntries), [calendarYearEntries]);

  return (
    <div className="animate-fade-in space-y-5">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white/80">
              <Sparkles className="h-4 w-4" />
              My Pay
            </div>
            <h1 className="mt-2 text-3xl font-black">See what your great work added up to.</h1>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Approved pay, combo rooms, and units are saved here for your records. New work appears after an
              administrator approves payroll.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-white/75">{selectedYear} Approved Pay</p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(yearSummary.totalPay)}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {(["WEEKLY", "MONTHLY", "YTD"] as const).map((view) => (
            <button
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeView === view ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
              }`}
              key={view}
              onClick={() => setActiveView(view)}
              type="button"
            >
              {view === "YTD" ? "Year to Date" : view === "WEEKLY" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous year"
            className="field-button secondary px-3"
            onClick={() => setSelectedYear((year) => year - 1)}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-20 text-center font-bold">{selectedYear}</span>
          <button
            aria-label="Next year"
            className="field-button secondary px-3"
            disabled={selectedYear >= currentYear}
            onClick={() => setSelectedYear((year) => year + 1)}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {history === undefined ? (
        <PayLoading />
      ) : calendarYearEntries.length === 0 ? (
        <section className="rounded-2xl border border-border bg-white p-8 text-center">
          <WalletCards className="mx-auto h-10 w-10 text-brand-500" />
          <h2 className="mt-3 text-xl font-bold">No approved pay for {selectedYear} yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Completed work appears here after payroll approval. If you expected to see a payment, ask an
            administrator to review the completed job.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={<WalletCards className="h-5 w-5" />}
              label="Approved Pay"
              value={formatCurrency(yearSummary.totalPay)}
            />
            <MetricCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Approved Jobs"
              value={formatNumber(yearSummary.jobCount)}
            />
            <MetricCard
              detail={`${formatNumber(yearSummary.totalComboRooms)} combo rooms + ${formatNumber(yearSummary.totalUnits)} units`}
              icon={<Layers3 className="h-5 w-5" />}
              label="Hours Paid"
              value={formatHours(yearSummary.totalPaidHours)}
            />
            <MetricCard
              icon={<Gauge className="h-5 w-5" />}
              label="Paid-Hour Rate"
              value={formatCurrency(yearSummary.paidHourlyRate)}
            />
            <MetricCard
              detail={actualHoursCoverage(yearSummary)}
              icon={<Gauge className="h-5 w-5" />}
              label="Actual Hours Worked"
              value={formatActualHours(yearSummary)}
            />
            <MetricCard
              detail="Approved pay divided by recorded checklist time"
              icon={<WalletCards className="h-5 w-5" />}
              label="True Hourly Wage"
              value={formatActualHourlyWage(yearSummary)}
            />
          </section>

          {activeView === "WEEKLY" ? <WeeklyHistory periods={weeklyPeriods} /> : null}
          {activeView === "MONTHLY" ? <MonthlyHistory periods={monthlyPeriods} /> : null}
          {activeView === "YTD" ? (
            <YearToDateHistory periods={monthlyPeriods} selectedYear={selectedYear} />
          ) : null}
        </>
      )}

      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        <p className="font-bold">How your hourly numbers work</p>
        <p className="mt-1 leading-6">
          Hours Paid are the property's approved combo rooms plus one unit per job, using the same locked values
          as Admin Payroll. Paid-Hour Rate divides approved pay by those hours. Actual Hours Worked run from
          checklist start through checklist completion, and True Hourly Wage divides pay by that recorded time.
          Team jobs split paid hours and pay evenly; each teammate receives the shared checklist's full elapsed
          time because the app does not record individual arrival or departure times.
        </p>
      </section>
    </div>
  );
}

function WeeklyHistory({ periods }: { periods: PayPeriod[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Weekly Pay History</h2>
        <p className="text-sm text-slate-600">Payroll weeks run Thursday through Wednesday.</p>
      </div>
      {periods.map((period) => (
        <article className="rounded-2xl border border-border bg-white p-4" key={period.periodStart}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{formatWeek(period)}</p>
              <p className="text-sm text-slate-600">
                {period.jobCount} approved job{period.jobCount === 1 ? "" : "s"} | {formatNumber(period.totalComboRooms)} combo rooms | {formatNumber(period.totalUnits)} units
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xl font-black text-emerald-700">{formatCurrency(period.totalPay)}</p>
              <Link
                aria-label={`Print pay stub for ${formatWeek(period)}`}
                className="field-button secondary px-3"
                target="_blank"
                rel="noreferrer"
                to={`/pay/week/${period.periodStart}`}
              >
                <Printer className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pay Stub</span>
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <SmallMetric label="Hours Paid" value={formatHours(period.totalPaidHours)} />
            <SmallMetric label="Paid-Hour Rate" value={formatCurrency(period.paidHourlyRate)} />
            <SmallMetric label="Actual Hours" value={formatActualHours(period)} />
            <SmallMetric label="True Hourly Wage" value={formatActualHourlyWage(period)} />
          </dl>
          {period.missingActualHoursJobCount > 0 ? (
            <p className="mt-3 text-xs font-semibold text-amber-700">
              Actual time is available for {period.actualHoursJobCount} of {period.jobCount} approved jobs; the true wage uses only those timed jobs.
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function MonthlyHistory({ periods }: { periods: PayPeriod[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">Monthly Pay History</h2>
        <p className="text-sm text-slate-600">Calendar-month totals built from approved work.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {periods.map((period) => (
          <article className="rounded-2xl border border-border bg-white p-4" key={period.periodStart}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">
                  {new Date(period.periodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </h3>
                <p className="text-sm text-slate-500">{period.jobCount} approved jobs</p>
              </div>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(period.totalPay)}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
              <SmallMetric label="Combo Rooms" value={formatNumber(period.totalComboRooms)} />
              <SmallMetric label="Units" value={formatNumber(period.totalUnits)} />
              <SmallMetric label="Hours Paid" value={formatHours(period.totalPaidHours)} />
              <SmallMetric label="Paid-Hour Rate" value={formatCurrency(period.paidHourlyRate)} />
              <SmallMetric label="Actual Hours" value={formatActualHours(period)} />
              <SmallMetric label="True Hourly Wage" value={formatActualHourlyWage(period)} />
            </dl>
            {period.missingActualHoursJobCount > 0 ? (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                True wage uses {period.actualHoursJobCount} of {period.jobCount} jobs with recorded time.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function YearToDateHistory({ periods, selectedYear }: { periods: PayPeriod[]; selectedYear: number }) {
  const hasMissingActualHours = periods.some((period) => period.missingActualHoursJobCount > 0);

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <h2 className="text-xl font-bold">{selectedYear} Year-to-Date Record</h2>
      <p className="text-sm text-slate-600">Monthly line items make it easy to track how approved earnings build over the year.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[940px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Month</th>
              <th className="px-3 py-3 text-right">Jobs</th>
              <th className="px-3 py-3 text-right">Combo Rooms</th>
              <th className="px-3 py-3 text-right">Units</th>
              <th className="px-3 py-3 text-right">Hours Paid</th>
              <th className="px-3 py-3 text-right">Paid-Hour Rate</th>
              <th className="px-3 py-3 text-right">Actual Hours</th>
              <th className="px-3 py-3 text-right">True Hourly Wage</th>
              <th className="px-3 py-3 text-right">Approved Pay</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr className="border-b border-slate-100" key={period.periodStart}>
                <td className="px-3 py-3 font-semibold">{new Date(period.periodStart).toLocaleDateString(undefined, { month: "long" })}</td>
                <td className="px-3 py-3 text-right">{period.jobCount}</td>
                <td className="px-3 py-3 text-right">{formatNumber(period.totalComboRooms)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(period.totalUnits)}</td>
                <td className="px-3 py-3 text-right">{formatHours(period.totalPaidHours)}</td>
                <td className="px-3 py-3 text-right">{formatCurrency(period.paidHourlyRate)}</td>
                <td className="px-3 py-3 text-right">{formatActualHours(period)}</td>
                <td className="px-3 py-3 text-right font-semibold text-emerald-700">{formatActualHourlyWage(period)}</td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">{formatCurrency(period.totalPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMissingActualHours ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          Months with missing checklist timing calculate true wage from timed approved jobs only.
        </p>
      ) : null}
    </section>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-brand-700">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}

function PayLoading() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton h-24 rounded-2xl" key={index} />)}
      </div>
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  );
}
