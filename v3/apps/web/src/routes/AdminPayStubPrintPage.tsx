import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Printer } from "lucide-react";
import { PayStubDocument } from "@/components/PayStubDocument";
import { DAY_MS, type WorkerPayEntry } from "@/lib/payHistory";

type AdminPayrollWorker = {
  assigneeId: Id<"users">;
  assigneeName: string;
  jobs: Array<{
    jobId: Id<"jobs">;
    jobType: "CLEANING" | "INSPECTION";
    completedAt?: number;
    roomComboUnits?: number;
    unitCount?: number;
    payrollAmount?: number;
    actualHoursWorked?: number;
  }>;
};

export function AdminPayStubPrintPage() {
  const { weekStart: weekStartParam, workerId } = useParams();
  const weekStart = Number(weekStartParam);
  const validPeriod = Number.isFinite(weekStart) && weekStart > 0 && Boolean(workerId);
  const payroll = useQuery(
    api.finance.listPayroll,
    validPeriod ? { weekStart, periodEnd: weekStart + 7 * DAY_MS } : "skip"
  ) as AdminPayrollWorker[] | undefined;
  const worker = payroll?.find((entry) => String(entry.assigneeId) === workerId);
  const entries: WorkerPayEntry[] =
    worker?.jobs.map((job) => ({
      jobId: String(job.jobId),
      completedAt: job.completedAt ?? 0,
      comboRooms: job.roomComboUnits ?? 0,
      unitCount: job.unitCount ?? 0,
      payrollAmount: job.payrollAmount ?? 0,
      paidHours: (job.roomComboUnits ?? 0) + (job.unitCount ?? 0),
      actualHoursWorked: job.actualHoursWorked,
    })) ?? [];
  const workerRole = worker?.jobs[0]?.jobType === "INSPECTION" ? "INSPECTOR" : "CLEANER";

  useEffect(() => {
    if (!worker) return;
    const previousTitle = document.title;
    document.title = `Pay Stub - ${worker.assigneeName} - ${new Date(weekStart).toLocaleDateString()}`;
    return () => {
      document.title = previousTitle;
    };
  }, [weekStart, worker]);

  if (!validPeriod) {
    return <p className="p-6 text-slate-600">That employee or pay period is not valid.</p>;
  }

  if (payroll === undefined) {
    return (
      <div className="mx-auto max-w-[8.5in] space-y-4 p-6">
        <div className="skeleton h-10 w-60 rounded" />
        <div className="skeleton h-[700px] rounded-2xl" />
      </div>
    );
  }

  if (!worker || entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <p className="text-slate-600">No approved pay was found for this employee and week.</p>
        <Link className="field-button secondary mt-4 px-4" to="/finance">Back to Finance</Link>
      </div>
    );
  }

  return (
    <div className="pay-stub-print-page min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <Link className="field-button secondary px-4" to="/finance">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Finance
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold">Employee Weekly Pay Stub</p>
          <p className="text-xs text-slate-500">Choose Save as PDF in the print destination to keep a copy.</p>
        </div>
        <button className="field-button primary px-4" onClick={() => window.print()} type="button">
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </button>
      </div>
      <PayStubDocument
        entries={entries}
        periodEnd={weekStart + 7 * DAY_MS}
        periodStart={weekStart}
        workerName={worker.assigneeName}
        workerRole={workerRole}
      />
    </div>
  );
}
