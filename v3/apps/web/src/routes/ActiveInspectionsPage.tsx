import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ButterflyEmptyState } from "@/components/ButterflyEmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type ActiveInspection = {
  _id: string;
  propertyName: string;
  type: "CLEANING" | "INSPECTION";
  status: "IN_PROGRESS" | "COMPLETED";
  assigneeName?: string;
};

export function ActiveInspectionsPage() {
  const { user, isCleaner, isInspector } = useCurrentUser();
  const items = useQuery(api.inspections.listActive) as ActiveInspection[] | undefined;

  const copy = isCleaner
    ? {
        eyebrow: "Active Checklists",
        title: "Current Active Checklists",
        description: "Resume in-progress clean checklists from here. New clean checklists should start from assigned cleans.",
        emptyHeading: "No active checklists",
        emptyDescription: "Your active clean checklists will show up here once a clean is underway.",
        cta: "Open Checklist",
      }
    : isInspector
      ? {
          eyebrow: "Active Inspections",
          title: "Current Active Inspections",
          description: "Resume in-progress inspections from here. New inspections should start from assigned jobs.",
          emptyHeading: "No active inspections",
          emptyDescription: "Your active inspections will show up here once an inspection job is underway.",
          cta: "Open Inspection",
        }
      : {
          eyebrow: "Active Work",
          title: "Current Active Inspections",
          description: "Resume in-progress inspections from here. New work should start from the schedule.",
          emptyHeading: "No active work",
          emptyDescription: "Start a checklist from dispatch or the schedule when one is ready.",
          cta: "Open Inspection",
        };

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          {copy.eyebrow}
        </p>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.description}</p>
      </div>

      {items === undefined ? (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <ButterflyEmptyState
          description={copy.emptyDescription}
          heading={copy.emptyHeading}
          eyebrow={copy.eyebrow}
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
                  {copy.cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
