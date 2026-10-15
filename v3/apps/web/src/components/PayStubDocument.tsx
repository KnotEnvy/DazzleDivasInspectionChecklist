import { summarizePay, type PayStubPeriodType, type WorkerPayEntry } from "@/lib/payHistory";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatHours(value: number) {
  return `${formatNumber(value)} hrs`;
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PayStubDocument(props: {
  workerName: string;
  workerRole: "CLEANER" | "INSPECTOR";
  periodStart: number;
  periodEnd: number;
  periodType?: PayStubPeriodType;
  entries: WorkerPayEntry[];
}) {
  const { workerName, workerRole, periodStart, periodEnd, periodType = "week", entries } = props;
  const summary = summarizePay(entries);
  const periodLabel = periodType === "week" ? "Weekly" : periodType === "month" ? "Monthly" : "Yearly";
  const preparedAt = Date.now();
  const recordThrough = Math.min(periodEnd - 1, preparedAt);

  return (
    <article className="pay-stub-document mx-auto w-full max-w-[8.5in] bg-white p-6 text-slate-900 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-brand-700 pb-6">
        <div className="flex items-start gap-4">
          <img
            alt="Dazzle Divas Cleaning logo"
            className="h-20 w-20 object-contain"
            src="/pink-dazzleLogo.WEBP"
          />
          <div className="pt-1 text-sm leading-6 text-slate-600">
            <p className="text-lg font-bold text-slate-900">Dazzle Divas Cleaning LLC</p>
            <p>{periodLabel} approved earnings record</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tracking-wide text-brand-700">PAY STUB</p>
          <p className="mt-1 text-sm font-semibold">
            {periodType === "week" ? "Thursday - Wednesday" : periodType === "month" ? "Calendar Month" : "Calendar Year"}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Worker</p>
          <p className="mt-1 text-lg font-bold">{workerName}</p>
          <p className="text-sm text-slate-600">
            {workerRole === "INSPECTOR" ? "Inspector" : "Cleaner"}
          </p>
        </div>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 self-start text-sm">
          <dt className="font-semibold text-slate-500">Period Start</dt>
          <dd className="text-right font-semibold">{formatDate(periodStart)}</dd>
          <dt className="font-semibold text-slate-500">Period End</dt>
          <dd className="text-right font-semibold">{formatDate(recordThrough)}</dd>
          <dt className="border-t border-slate-200 pt-2 font-bold text-slate-700">Approved Gross Earnings</dt>
          <dd className="border-t border-slate-200 pt-2 text-right text-lg font-black text-brand-700">
            {formatCurrency(summary.totalPay)}
          </dd>
        </dl>
      </section>

      <section className="mt-7 rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{periodLabel} Totals</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCell label="Approved Jobs" value={String(summary.jobCount)} />
          <SummaryCell label="Combo Rooms" value={formatNumber(summary.totalComboRooms)} />
          <SummaryCell label="Units" value={formatNumber(summary.totalUnits)} />
          <SummaryCell label="Hours Paid" value={formatHours(summary.totalPaidHours)} />
        </div>
      </section>

      <footer className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
        <p className="font-semibold">Prepared {formatDate(preparedAt)}</p>
        <p>
          This record summarizes approved gross earnings for the period shown, before deductions or
          adjustments outside the app. It is not a tax document.
        </p>
      </footer>
    </article>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  );
}
