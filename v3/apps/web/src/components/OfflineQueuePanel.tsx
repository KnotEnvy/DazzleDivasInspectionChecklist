import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineSync } from "@/app/OfflineSyncProvider";
import {
  clearResolvedOutboxItems,
  discardOutboxItem,
  describeOutboxItem,
  getDiscardedDependentOutboxItemCount,
  retryOutboxItem,
  type OutboxItem,
} from "@/lib/offlineOutbox";
import {
  formatConflictMessage,
  getOutboxReviewHref,
  getReplayConflictPolicy,
} from "@/lib/offlineReplay";

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
  const actionableCount = items.filter(
    (item) => item.status === "QUEUED" || item.status === "PROCESSING" || item.status === "FAILED"
  ).length;
  const conflictCount = items.filter((item) => item.status === "CONFLICT").length;
  const syncedCount = items.filter((item) => item.status === "SYNCED").length;
  const hasSyncedItems = syncedCount > 0;

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

  async function handleRetryConflict(item: OutboxItem) {
    const policy = getReplayConflictPolicy(item);

    if (!policy.canRetry) {
      toast.error("Refresh the live schedule before retrying this action");
      return;
    }

    if (!isOnline) {
      toast.error("Reconnect before retrying a conflicted action");
      return;
    }

    await retryOutboxItem(item.id);
    const result = await flushNow();

    if (result.synced > 0) {
      toast.success("Conflict requeued and synced");
      return;
    }

    if (result.conflicts > 0) {
      toast.error("Conflict still needs manual review");
      return;
    }

    if (result.failed > 0) {
      toast.error("Retry paused because the connection dropped again");
      return;
    }

    toast("Conflict requeued for the next sync pass");
  }

  async function handleDiscardConflict(item: OutboxItem) {
    const dependentDiscardCount = getDiscardedDependentOutboxItemCount(items, item.id);
    await discardOutboxItem(item.id);
    if (dependentDiscardCount > 0) {
      toast.success(
        `Queued conflict discarded with ${dependentDiscardCount} dependent completion action${
          dependentDiscardCount === 1 ? "" : "s"
        }`
      );
      return;
    }

    toast.success("Queued conflict discarded");
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
            disabled={!isOnline || syncing || actionableCount === 0}
            onClick={() => void handleSyncNow()}
            type="button"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            className="field-button secondary px-4"
            disabled={!hasSyncedItems}
            onClick={() => void handleClearResolved()}
            type="button"
          >
            Clear Resolved
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
          Open: {actionableCount}
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
          Conflicts: {conflictCount}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          Synced: {syncedCount}
        </span>
      </div>

      {visibleItems.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No queued sync activity yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => {
            const conflictPolicy =
              item.status === "CONFLICT" ? getReplayConflictPolicy(item) : null;
            const dependentDiscardCount =
              item.status === "CONFLICT"
                ? getDiscardedDependentOutboxItemCount(items, item.id)
                : 0;

            return (
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
                    {item.status === "CONFLICT" && conflictPolicy ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-rose-800">{formatConflictMessage(item)}</p>
                        <p className="text-xs text-slate-600">{conflictPolicy.nextStep}</p>
                        {dependentDiscardCount > 0 ? (
                          <p className="text-xs text-amber-700">
                            Discarding this will also clear {dependentDiscardCount} queued
                            completion follow-up{dependentDiscardCount === 1 ? "" : "s"} that
                            depend on it.
                          </p>
                        ) : null}
                      </div>
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
                {item.status === "CONFLICT" && conflictPolicy ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      className="field-button secondary px-3"
                      to={getOutboxReviewHref(item)}
                    >
                      Review Live State
                    </Link>
                    <button
                      className="field-button secondary px-3"
                      disabled={!conflictPolicy.canRetry || !isOnline || syncing}
                      onClick={() => void handleRetryConflict(item)}
                      type="button"
                    >
                      Retry Replay
                    </button>
                    <button
                      className="field-button secondary px-3"
                      onClick={() => void handleDiscardConflict(item)}
                      type="button"
                    >
                      Discard Item
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
