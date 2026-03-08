import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useConvex, useConvexAuth } from "convex/react";
import { flushOfflineOutbox, type OfflineReplayResult } from "@/lib/offlineReplay";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";

type OfflineSyncContextValue = {
  syncing: boolean;
  lastReplayResult: OfflineReplayResult | null;
  flushNow: () => Promise<OfflineReplayResult>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

function emptyReplayResult(): OfflineReplayResult {
  return {
    attempted: 0,
    synced: 0,
    failed: 0,
    conflicts: 0,
    stoppedByNetwork: false,
  };
}

export function OfflineSyncProvider({ children }: PropsWithChildren) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const isOnline = useNetworkStatus();
  const { count } = useOutboxCount();
  const [syncing, setSyncing] = useState(false);
  const [lastReplayResult, setLastReplayResult] = useState<OfflineReplayResult | null>(null);
  const syncingRef = useRef(false);

  const flushNow = useEffectEvent(async () => {
    if (!isOnline || !isAuthenticated || syncingRef.current) {
      return emptyReplayResult();
    }

    syncingRef.current = true;
    setSyncing(true);

    try {
      const result = await flushOfflineOutbox(convex);
      setLastReplayResult(result);
      return result;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  });

  useEffect(() => {
    if (!isOnline || !isAuthenticated || count === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void flushNow();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [count, flushNow, isAuthenticated, isOnline]);

  return (
    <OfflineSyncContext.Provider
      value={{
        syncing,
        lastReplayResult,
        flushNow,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const value = useContext(OfflineSyncContext);

  if (!value) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }

  return value;
}
