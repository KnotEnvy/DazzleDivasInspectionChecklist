import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";
import { flushCreateInspectionOutbox } from "@/lib/offlineOutbox";
export function DashboardPage() {
    const { user } = useCurrentUser();
    const isOnline = useNetworkStatus();
    const { count, refresh } = useOutboxCount();
    const active = useQuery(api.inspections.listActive);
    const mine = useQuery(api.propertyAssignments.listMine);
    const createInspection = useMutation(api.inspections.create);
    const [syncing, setSyncing] = useState(false);
    async function handleSyncOutbox() {
        if (!isOnline) {
            toast.error("Reconnect to sync queued actions");
            return;
        }
        setSyncing(true);
        const result = await flushCreateInspectionOutbox((payload) => createInspection({
            propertyId: payload.propertyId,
            type: payload.type,
        }));
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
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("section", { className: "grid gap-3 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Current role" }), _jsx("p", { className: "text-xl font-bold", children: user?.role ?? "Loading..." })] }), _jsxs("div", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Active checklists" }), _jsx("p", { className: "text-xl font-bold", children: active?.length ?? "..." })] }), _jsxs("div", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Queued offline actions" }), _jsx("p", { className: "text-xl font-bold", children: count })] })] }), _jsxs("section", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsx("h2", { className: "text-lg font-bold", children: "Offline Outbox" }), _jsx("button", { className: "field-button secondary px-4", disabled: !isOnline || syncing || count === 0, onClick: () => void handleSyncOutbox(), children: syncing ? "Syncing..." : "Sync Queue" })] }), _jsx("p", { className: "text-sm text-slate-600", children: "New checklists created while offline are stored locally and replayed when you reconnect." })] }), _jsxs("section", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("h2", { className: "mb-2 text-lg font-bold", children: "Assigned Properties" }), mine === undefined ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading assignments..." })) : mine.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No active assignments." })) : (_jsx("div", { className: "space-y-2", children: mine.map((assignment) => (_jsxs("div", { className: "rounded-xl border border-border p-3", children: [_jsx("p", { className: "font-semibold", children: assignment.property?.name ?? "Unknown property" }), _jsx("p", { className: "text-sm text-slate-500", children: assignment.property?.address ?? "" })] }, assignment._id))) }))] }), _jsxs("section", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("h2", { className: "mb-2 text-lg font-bold", children: "Active Checklists" }), active === undefined ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading checklists..." })) : active.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No active checklist in progress." })) : (_jsx("div", { className: "space-y-2", children: active.map((inspection) => (_jsxs(Link, { className: "block rounded-xl border border-border p-3 transition hover:border-brand-400", to: `/checklists/${inspection._id}`, children: [_jsx("p", { className: "font-semibold", children: inspection.propertyName }), _jsxs("p", { className: "text-sm text-slate-500", children: [inspection.type, " \u2022 ", inspection.status] })] }, inspection._id))) }))] })] }));
}
