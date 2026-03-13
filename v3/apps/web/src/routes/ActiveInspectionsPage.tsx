import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type ActiveInspection = {
  _id: string;
  propertyName: string;
  type: "CLEANING" | "INSPECTION";
  status: "IN_PROGRESS" | "COMPLETED";
  assigneeName?: string;
};

export function ActiveInspectionsPage() {
  const { user } = useCurrentUser();
  const items = useQuery(api.inspections.listActive) as ActiveInspection[] | undefined;

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Active Work
        </p>
        <h1 className="text-2xl font-bold">Current Active Inspections</h1>
        <p className="text-sm text-slate-600">
          Resume in-progress inspections from here. New checklists should start from assigned jobs.
        </p>
      </div>

      {items === undefined ? (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          heading="No active inspections"
          description={
            user?.role === "ADMIN"
              ? "Start a checklist from dispatch or create one manually if needed."
              : "You do not have any active inspections right now. Start one from My Schedule when a job is ready."
          }
          action={
            <Link
              className="field-button primary px-5"
              to={user?.role === "ADMIN" ? "/schedule" : "/my-schedule"}
            >
              {user?.role === "ADMIN" ? "Open Dispatch" : "Go To My Schedule"}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((inspection) => (
            <Link
              key={inspection._id}
              className="block rounded-2xl border border-border bg-white p-4 transition hover:border-brand-400"
              to={`/checklists/${inspection._id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{inspection.propertyName}</p>
                  <p className="text-sm text-slate-600">
                    {inspection.type} | {inspection.status}
                  </p>
                  {inspection.assigneeName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Assigned to {inspection.assigneeName}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  Open Inspection
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
