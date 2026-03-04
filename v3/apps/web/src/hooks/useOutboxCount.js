import { useCallback, useEffect, useState } from "react";
import { getOutboxCount } from "@/lib/offlineOutbox";
export function useOutboxCount() {
    const [count, setCount] = useState(0);
    const refresh = useCallback(async () => {
        setCount(await getOutboxCount());
    }, []);
    useEffect(() => {
        const handler = () => void refresh();
        window.addEventListener("dazzle:outbox-changed", handler);
        void refresh();
        return () => {
            window.removeEventListener("dazzle:outbox-changed", handler);
        };
    }, [refresh]);
    return {
        count,
        refresh,
    };
}
