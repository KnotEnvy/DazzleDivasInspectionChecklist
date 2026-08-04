import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ArrowLeft, Printer } from "lucide-react";
import { PayStubDocument } from "@/components/PayStubDocument";
import { DAY_MS, type WorkerPayHistory } from "@/lib/payHistory";

export function PayStubPrintPage() {
  const { weekStart: weekStartParam } = useParams();
  const weekStart = Number(weekStartParam);
  const validWeekStart = Number.isFinite(weekStart) && weekStart > 0;
  const history = useQuery(
    api.finance.getMyPayHistory,
    validWeekStart ? { from: weekStart, to: weekStart + 7 * DAY_MS } : "skip"
  ) as WorkerPayHistory | undefined;

  useEffect(() => {
    if (!history) return;
    const previousTitle = document.title;
    document.title = `Pay Stub - ${history.workerName} - ${new Date(weekStart).toLocaleDateString()}`;
    return () => {
      document.title = previousTitle;
    };
  }, [history, weekStart]);

  if (!validWeekStart) {
    return <p className="p-6 text-slate-600">That pay period is not valid.</p>;
  }

  if (history === undefined) {
    return (
      <div className="mx-auto max-w-[8.5in] space-y-4 p-6">
        <div className="skeleton h-10 w-60 rounded" />
        <div className="skeleton h-[700px] rounded-2xl" />
      </div>
    );
  }

  if (history.entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <p className="text-slate-600">No approved pay was found for this week.</p>
        <Link className="field-button secondary mt-4 px-4" to="/pay">Back to My Pay</Link>
      </div>
    );
  }

  return (
    <div className="pay-stub-print-page min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <Link className="field-button secondary px-4" to="/pay">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Pay
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold">Weekly Pay Stub</p>
          <p className="text-xs text-slate-500">Choose Save as PDF in the print destination to keep a copy.</p>
        </div>
        <button className="field-button primary px-4" onClick={() => window.print()} type="button">
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </button>
      </div>
      <PayStubDocument
        entries={history.entries}
        periodEnd={weekStart + 7 * DAY_MS}
        periodStart={weekStart}
        workerName={history.workerName}
        workerRole={history.workerRole}
      />
    </div>
  );
}
