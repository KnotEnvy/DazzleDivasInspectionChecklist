import { useCallback, useEffect, useState } from "react";
import { getOutboxItems, type OutboxItem } from "@/lib/offlineOutbox";

export function useOutboxItems(options?: { includeResolved?: boolean }) {
  const includeResolved = options?.includeResolved === true;
  const [items, setItems] = useState<OutboxItem[]>([]);

  const refresh = useCallback(async () => {
    setItems(await getOutboxItems({ includeResolved }));
  }, [includeResolved]);

  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener("dazzle:outbox-changed", handler);
    void refresh();

    return () => {
      window.removeEventListener("dazzle:outbox-changed", handler);
    };
  }, [refresh]);

  return {
    items,
    refresh,
  };
}
