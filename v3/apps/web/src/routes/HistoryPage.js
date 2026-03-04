import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
export function HistoryPage() {
    const items = useQuery(api.inspections.listCompleted);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Completed Checklists" }), items === undefined ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading history..." })) : items.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No completed checklist yet." })) : (_jsx("div", { className: "space-y-2", children: items.map((item) => (_jsxs(Link, { to: `/checklists/${item._id}`, className: "block rounded-xl border border-border bg-white p-3 transition hover:border-brand-400", children: [_jsx("p", { className: "font-semibold", children: item.propertyName }), _jsxs("p", { className: "text-sm text-slate-600", children: [item.type, " \u2022 ", new Date(item._creationTime).toLocaleString()] })] }, item._id))) }))] }));
}
