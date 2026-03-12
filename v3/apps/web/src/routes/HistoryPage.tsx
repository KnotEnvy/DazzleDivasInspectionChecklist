import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Clock3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type CompletedInspection = {
  _id: string;
  _creationTime: number;
  completedAt?: number;
  propertyName: string;
  type: string;
  issueCount?: number;
};

export function HistoryPage() {
  const items = useQuery(api.inspections.listCompleted) as
    | CompletedInspection[]
    | undefined;

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold">Completed Checklists</h1>

      {items === undefined ? (
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
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item._id}
              to={`/checklists/${item._id}`}
              className="block rounded-xl border border-border bg-white p-3 transition hover:border-brand-400"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold">{item.propertyName}</p>
                {(item.issueCount ?? 0) > 0 ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    {item.issueCount} issue{item.issueCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">
                {item.type} | {new Date(item.completedAt ?? item._creationTime).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
