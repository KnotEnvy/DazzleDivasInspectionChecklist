import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";
import { flushCreateInspectionOutbox } from "@/lib/offlineOutbox";

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
  const isOnline = useNetworkStatus();
  const { count, refresh } = useOutboxCount();

  const active = useQuery(api.inspections.listActive) as
    | ActiveInspection[]
    | undefined;
  const mine = useQuery(api.propertyAssignments.listMine) as
    | AssignedProperty[]
    | undefined;
  const createInspection = useMutation(api.inspections.create);

  const [syncing, setSyncing] = useState(false);

  async function handleSyncOutbox() {
    if (!isOnline) {
      toast.error("Reconnect to sync queued actions");
      return;
    }

    setSyncing(true);
    const result = await flushCreateInspectionOutbox((payload) =>
      createInspection({
        propertyId: payload.propertyId as Id<"properties">,
        type: payload.type,
      })
    );

    if (result.processed > 0) {
      toast.success(`Synced ${result.processed} queued checklist(s)`);
    }

    if (result.failed > 0) {
      toast.error(`${result.failed} queued item(s) still failed`);
    }

    if (result.processed === 0 && result.failed === 0) {
      toast("Queue is already empty");
    }

    await refresh();
    setSyncing(false);
  }

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

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Offline Outbox</h2>
          <button
            className="field-button secondary px-4"
            disabled={!isOnline || syncing || count === 0}
            onClick={() => void handleSyncOutbox()}
          >
            {syncing ? "Syncing..." : "Sync Queue"}
          </button>
        </div>
        <p className="text-sm text-slate-600">
          New checklists created while offline are stored locally and replayed when you reconnect.
        </p>
      </section>

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