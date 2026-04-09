import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LockOpen } from "lucide-react";

export type InspectionFinanceReview = {
  jobId: string;
  inspectionId: string;
  propertyName: string;
  assigneeName: string;
  scheduledStart: number;
  completedAt?: number;
  jobStatus: string;
  financeStatus: "FORECAST" | "PENDING_REVIEW" | "APPROVED";
  revenueAmount?: number;
  roomComboUnits?: number;
  perRoomComboRate?: number;
  unitBonus?: number;
  payrollAmount?: number;
  grossMargin?: number;
  missingFields: string[];
  warnings: string[];
  adminNotes: string;
  approvedAt?: number;
  approvedById?: string;
  unlockReason?: string;
  canApprove: boolean;
};

type FinanceDraft = {
  revenueAmount: string;
  roomComboUnits: string;
  perRoomComboRate: string;
  unitBonus: string;
  adminNotes: string;
};

function toInputValue(value?: number) {
  return value === undefined ? "" : String(value);
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

export function InspectionFinancePanel(props: {
  review: InspectionFinanceReview | null;
  saving: boolean;
  approving: boolean;
  unlocking: boolean;
  onSave: (draft: FinanceDraft) => Promise<void>;
  onApprove: (draft: FinanceDraft) => Promise<void>;
  onUnlock: (reason: string) => Promise<void>;
}) {
  const { review, saving, approving, unlocking, onSave, onApprove, onUnlock } = props;
  const [draft, setDraft] = useState<FinanceDraft>({
    revenueAmount: "",
    roomComboUnits: "",
    perRoomComboRate: "",
    unitBonus: "",
    adminNotes: "",
  });
  const [unlockReason, setUnlockReason] = useState("");

  useEffect(() => {
    if (!review) {
      return;
    }

    setDraft({
      revenueAmount: toInputValue(review.revenueAmount),
      roomComboUnits: toInputValue(review.roomComboUnits),
      perRoomComboRate: toInputValue(review.perRoomComboRate),
      unitBonus: toInputValue(review.unitBonus),
      adminNotes: review.adminNotes ?? "",
    });
    setUnlockReason(review.unlockReason ?? "");
  }, [review]);

  if (!review) {
    return (
      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-lg font-bold">Finance Approval</h2>
        <p className="mt-2 text-sm text-slate-600">
          This checklist is not linked to a cleaning job finance record.
        </p>
      </section>
    );
  }

  const locked = review.financeStatus === "APPROVED";

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Finance Approval</h2>
          <p className="text-sm text-slate-600">
            Review the revenue and payroll snapshot before this job counts in realized totals.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          locked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
        }`}>
          {review.financeStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SummaryCell label="Revenue" value={formatCurrency(review.revenueAmount)} />
        <SummaryCell label="Payroll" value={formatCurrency(review.payrollAmount)} />
        <SummaryCell label="Gross" value={formatCurrency(review.grossMargin)} />
        <SummaryCell
          label="Completed"
          value={review.completedAt ? new Date(review.completedAt).toLocaleString() : "--"}
        />
      </div>

      {review.warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Review Needed
          </div>
          <p className="mt-1">{review.warnings.join(" ")}</p>
        </div>
      ) : null}

      {review.missingFields.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Missing fields: {review.missingFields.join(", ")}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">
          Revenue Amount
          <input
            className="input mt-1"
            disabled={locked}
            onChange={(event) => setDraft((current) => ({ ...current, revenueAmount: event.target.value }))}
            step="0.01"
            type="number"
            value={draft.revenueAmount}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Room Combo Units
          <input
            className="input mt-1"
            disabled={locked}
            onChange={(event) => setDraft((current) => ({ ...current, roomComboUnits: event.target.value }))}
            step="0.5"
            type="number"
            value={draft.roomComboUnits}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Per-Room Rate
          <input
            className="input mt-1"
            disabled={locked}
            onChange={(event) => setDraft((current) => ({ ...current, perRoomComboRate: event.target.value }))}
            step="0.01"
            type="number"
            value={draft.perRoomComboRate}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Unit Bonus
          <input
            className="input mt-1"
            disabled={locked}
            onChange={(event) => setDraft((current) => ({ ...current, unitBonus: event.target.value }))}
            step="0.01"
            type="number"
            value={draft.unitBonus}
          />
        </label>
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        Admin Notes
        <textarea
          className="input mt-1 min-h-24"
          disabled={locked}
          onChange={(event) => setDraft((current) => ({ ...current, adminNotes: event.target.value }))}
          value={draft.adminNotes}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {!locked ? (
          <>
            <button
              className="field-button secondary px-4"
              disabled={saving}
              onClick={() => void onSave(draft)}
              type="button"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              className="field-button primary px-4"
              disabled={approving || !review.canApprove}
              onClick={() => void onApprove(draft)}
              type="button"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {approving ? "Approving..." : "Approve Finance"}
            </button>
          </>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Approved {review.approvedAt ? new Date(review.approvedAt).toLocaleString() : ""}
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Unlock Reason
            <textarea
              className="input mt-1 min-h-20"
              onChange={(event) => setUnlockReason(event.target.value)}
              value={unlockReason}
            />
          </label>
          <button
            className="field-button secondary mt-3 px-4"
            disabled={unlocking || unlockReason.trim().length === 0}
            onClick={() => void onUnlock(unlockReason.trim())}
            type="button"
          >
            <LockOpen className="mr-2 h-4 w-4" />
            {unlocking ? "Unlocking..." : "Unlock For Edit"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
