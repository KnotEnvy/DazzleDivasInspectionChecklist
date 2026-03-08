import toast from "react-hot-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineSync } from "@/app/OfflineSyncProvider";
import {
  clearResolvedOutboxItems,
  describeOutboxItem,
  type OutboxItem,
} from "@/lib/offlineOutbox";

function statusTone(status: OutboxItem["status"]) {
  switch (status) {
    case "QUEUED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "PROCESSING":
      return "border-brand-200 bg-brand-50 text-brand-700";
    case "FAILED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CONFLICT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "SYNCED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

type OfflineQueuePanelProps = {
  title: string;
  description: string;
  items: OutboxItem[];
  maxItems?: number;
};

export function OfflineQueuePanel({
  title,
  description,
  items,
  maxItems = 5,
}: OfflineQueuePanelProps) {
  const isOnline = useNetworkStatus();
  const { syncing, flushNow } = useOfflineSync();
  const visibleItems = items
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, maxItems);
  const unresolvedCount = items.filter((item) => item.status !== "SYNCED").length;
  const hasResolvedItems = items.some((item) => item.status === "SYNCED" || item.status === "CONFLICT");

  async function handleSyncNow() {
    if (!isOnline) {
      toast.error("Reconnect to sync queued actions");
      return;
    }

    const result = await flushNow();

    if (result.synced > 0) {
      toast.success(`Synced ${result.synced} queued action${result.synced === 1 ? "" : "s"}`);
    }

    if (result.conflicts > 0) {
      toast.error(`${result.conflicts} action${result.conflicts === 1 ? "" : "s"} need review`);
    }

    if (result.failed > 0) {
      toast.error("Sync paused because the connection dropped again");
    }

    if (result.attempted === 0) {
      toast("No queued actions need syncing");
    }
  }

  async function handleClearResolved() {
    await clearResolvedOutboxItems();
    toast.success("Resolved sync items cleared");
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="field-button secondary px-4"
            disabled={!isOnline || syncing || unresolvedCount === 0}
            onClick={() => void handleSyncNow()}
            type="button"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            className="field-button secondary px-4"
            disabled={!hasResolvedItems}
            onClick={() => void handleClearResolved()}
            type="button"
          >
            Clear Resolved
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
          Open: {unresolvedCount}
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
          Conflicts: {items.filter((item) => item.status === "CONFLICT").length}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          Synced: {items.filter((item) => item.status === "SYNCED").length}
        </span>
      </div>

      {visibleItems.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No queued sync activity yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-slate-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{describeOutboxItem(item)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.lastError ? (
                    <p className="mt-1 text-xs text-rose-700">{item.lastError}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
