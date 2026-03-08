import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOutboxCount } from "@/hooks/useOutboxCount";
import { useOutboxItems } from "@/hooks/useOutboxItems";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";

type ActiveInspection = {
  _id: string;
  propertyName: string;
  type: string;
  status: string;
};

type AssignedProperty = {
  _id: string;
  property?: {
    name?: string;
    address?: string;
  } | null;
};

export function DashboardPage() {
  const { user } = useCurrentUser();
  const { count } = useOutboxCount();
  const { items } = useOutboxItems({ includeResolved: true });

  const active = useQuery(api.inspections.listActive) as
    | ActiveInspection[]
    | undefined;
  const mine = useQuery(api.propertyAssignments.listMine) as
    | AssignedProperty[]
    | undefined;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Current role</p>
          <p className="text-xl font-bold">{user?.role ?? "Loading..."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Active checklists</p>
          <p className="text-xl font-bold">{active?.length ?? "..."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Queued offline actions</p>
          <p className="text-xl font-bold">{count}</p>
        </div>
      </section>

      <OfflineQueuePanel
        description="Field actions now queue locally when you lose connection and replay when the device reconnects."
        items={items}
        title="Offline Outbox"
      />

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Assigned Properties</h2>
        {mine === undefined ? (
          <p className="text-sm text-slate-500">Loading assignments...</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-slate-500">No active assignments.</p>
        ) : (
          <div className="space-y-2">
            {mine.map((assignment) => (
              <div key={assignment._id} className="rounded-xl border border-border p-3">
                <p className="font-semibold">{assignment.property?.name ?? "Unknown property"}</p>
                <p className="text-sm text-slate-500">{assignment.property?.address ?? ""}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Active Checklists</h2>
        {active === undefined ? (
          <p className="text-sm text-slate-500">Loading checklists...</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-500">No active checklist in progress.</p>
        ) : (
          <div className="space-y-2">
            {active.map((inspection) => (
              <Link
                key={inspection._id}
                className="block rounded-xl border border-border p-3 transition hover:border-brand-400"
                to={`/checklists/${inspection._id}`}
              >
                <p className="font-semibold">{inspection.propertyName}</p>
                <p className="text-sm text-slate-500">
                  {inspection.type} • {inspection.status}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
