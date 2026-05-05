import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";
import { AlertTriangle, Clock3, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type CompletedInspection = {
  _id: string;
  _creationTime: number;
  completedAt?: number;
  propertyName: string;
  type: string;
  assigneeName?: string;
  issueCount?: number;
  financialApproved?: boolean;
};

function isSameLocalDay(timestamp: number, referenceDate: Date) {
  const value = new Date(timestamp);

  return (
    value.getFullYear() === referenceDate.getFullYear() &&
    value.getMonth() === referenceDate.getMonth() &&
    value.getDate() === referenceDate.getDate()
  );
}

function formatCompletionTime(timestamp: number, referenceDate: Date) {
  const completedAt = new Date(timestamp);

  if (isSameLocalDay(timestamp, referenceDate)) {
    return completedAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return completedAt.toLocaleString();
}

function HistorySection({
  heading,
  description,
  items,
  referenceDate,
  deletingInspectionId,
  isAdmin,
  onRequestDelete,
}: {
  heading: string;
  description: string;
  items: CompletedInspection[];
  referenceDate: Date;
  deletingInspectionId: string | null;
  isAdmin: boolean;
  onRequestDelete: (item: CompletedInspection) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">{heading}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-slate-500">
          No completed checklists in this section yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const completedAt = item.completedAt ?? item._creationTime;

            return (
              <div
                key={item._id}
                className="rounded-2xl border border-border bg-white p-4 transition hover:border-brand-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link className="group block" to={`/checklists/${item._id}`}>
                      <p className="flex items-center gap-2 font-semibold group-hover:text-brand-700">
                        {item.financialApproved ? (
                          <span
                            aria-label="Financials approved"
                            className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                            title="Financials approved"
                          />
                        ) : null}
                        <span>{item.propertyName}</span>
                      </p>
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.type} | Finished {formatCompletionTime(completedAt, referenceDate)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cleaner: {item.assigneeName?.trim() || "Unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(item.issueCount ?? 0) > 0 ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        {item.issueCount} issue{item.issueCount === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        No issues
                      </span>
                    )}
                    {isAdmin ? (
                      <button
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        disabled={deletingInspectionId === item._id}
                        onClick={() => onRequestDelete(item)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingInspectionId === item._id ? "Deleting" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HistoryPage() {
  const { isAdmin } = useCurrentUser();
  const deleteCompletedFromHistory = useMutation(api.inspections.deleteCompletedFromHistory);
  const [deleteTarget, setDeleteTarget] = useState<CompletedInspection | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingInspectionId, setDeletingInspectionId] = useState<string | null>(null);
  const { results: items, status, loadMore } = usePaginatedQuery(
    api.inspections.listCompletedPaginated,
    {},
    { initialNumItems: 30 }
  ) as {
    results: CompletedInspection[];
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
    loadMore: (numItems: number) => void;
  };
  const referenceDate = new Date();
  const todayLabel = referenceDate.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayItems =
    items?.filter((item) => isSameLocalDay(item.completedAt ?? item._creationTime, referenceDate)) ?? [];
  const earlierItems =
    items?.filter((item) => !isSameLocalDay(item.completedAt ?? item._creationTime, referenceDate)) ?? [];

  async function handleDeleteFromHistory() {
    if (!deleteTarget) {
      return;
    }

    const reason = deleteReason.trim();
    if (reason.length < 10) {
      toast.error("Enter a deletion reason with at least 10 characters");
      return;
    }

    setDeletingInspectionId(deleteTarget._id);
    try {
      await deleteCompletedFromHistory({
        inspectionId: deleteTarget._id as Id<"inspections">,
        reason,
      });
      toast.success("Completed job removed from history");
      setDeleteTarget(null);
      setDeleteReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete completed job");
    } finally {
      setDeletingInspectionId(null);
    }
  }

  function requestDelete(item: CompletedInspection) {
    setDeleteTarget(item);
    setDeleteReason("");
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Completed Checklists</h1>
          <p className="text-sm text-slate-600">
            Start with today&apos;s finished jobs so admin can review photos quickly.
          </p>
        </div>
        {status !== "LoadingFirstPage" ? (
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{todayItems.length}</p>
            <p>Finished on {todayLabel}</p>
          </div>
        ) : null}
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Clock3 className="h-8 w-8" />}
          heading="No completed checklists yet"
          description="Checklists you finish will appear here for review."
        />
      ) : (
        <>
          <HistorySection
            heading="Finished Today"
            description="Open any job here to review notes and save the completed photos."
            items={todayItems}
            referenceDate={referenceDate}
            deletingInspectionId={deletingInspectionId}
            isAdmin={isAdmin}
            onRequestDelete={requestDelete}
          />
          <HistorySection
            heading="Earlier Jobs"
            description="Older completed jobs stay here for follow-up review."
            items={earlierItems}
            referenceDate={referenceDate}
            deletingInspectionId={deletingInspectionId}
            isAdmin={isAdmin}
            onRequestDelete={requestDelete}
          />
          {status !== "Exhausted" ? (
            <div className="flex justify-center pt-2">
              <button
                className="field-button secondary px-4"
                disabled={status !== "CanLoadMore"}
                onClick={() => loadMore(30)}
                type="button"
              >
                {status === "LoadingMore" ? "Loading Older Jobs..." : "Load Older Jobs"}
              </button>
            </div>
          ) : null}
        </>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Delete Completed Job</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This removes the completed checklist, linked job, photos, finance record, and cleaner history entry. An admin audit note will remain.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{deleteTarget.propertyName}</p>
              <p className="text-slate-600">
                {deleteTarget.type} | Cleaner: {deleteTarget.assigneeName?.trim() || "Unassigned"}
              </p>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Deletion Reason
              <textarea
                className="input mt-1 min-h-28"
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Example: Cancelled due to guest extension"
                value={deleteReason}
              />
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="field-button ghost px-4"
                disabled={deletingInspectionId === deleteTarget._id}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason("");
                }}
                type="button"
              >
                Keep Job
              </button>
              <button
                className="field-button danger px-4"
                disabled={deletingInspectionId === deleteTarget._id}
                onClick={() => void handleDeleteFromHistory()}
                type="button"
              >
                {deletingInspectionId === deleteTarget._id ? "Deleting..." : "Delete From History"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
