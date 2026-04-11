import { Link } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Clock3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

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
}: {
  heading: string;
  description: string;
  items: CompletedInspection[];
  referenceDate: Date;
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
              <Link
                key={item._id}
                to={`/checklists/${item._id}`}
                className="block rounded-2xl border border-border bg-white p-4 transition hover:border-brand-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {item.financialApproved ? (
                        <span
                          aria-label="Financials approved"
                          className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                          title="Financials approved"
                        />
                      ) : null}
                      <span>{item.propertyName}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.type} | Finished {formatCompletionTime(completedAt, referenceDate)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cleaner: {item.assigneeName?.trim() || "Unassigned"}
                    </p>
                  </div>
                  {(item.issueCount ?? 0) > 0 ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      {item.issueCount} issue{item.issueCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      No issues
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HistoryPage() {
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
          />
          <HistorySection
            heading="Earlier Jobs"
            description="Older completed jobs stay here for follow-up review."
            items={earlierItems}
            referenceDate={referenceDate}
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
    </div>
  );
}
