import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
export function AdminPage() {
    const stats = useQuery(api.admin.stats);
    const users = useQuery(api.users.list);
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Admin Console" }), _jsx("p", { className: "text-sm text-slate-600", children: "Starter controls for operations and staffing." })] }), _jsxs("section", { className: "grid gap-3 lg:grid-cols-4", children: [_jsx(Card, { label: "Users", value: stats?.users }), _jsx(Card, { label: "Active Properties", value: stats?.activeProperties }), _jsx(Card, { label: "In Progress", value: stats?.activeInspections }), _jsx(Card, { label: "Completed", value: stats?.completedInspections })] }), _jsxs("section", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("h2", { className: "mb-2 text-lg font-bold", children: "Users" }), users === undefined ? (_jsx("p", { className: "text-sm text-slate-500", children: "Loading users..." })) : users.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No users yet." })) : (_jsx("div", { className: "space-y-2", children: users.map((user) => (_jsxs("div", { className: "rounded-xl border border-border p-3", children: [_jsx("p", { className: "font-semibold", children: user.name }), _jsx("p", { className: "text-sm text-slate-600", children: user.email }), _jsxs("p", { className: "text-xs font-semibold text-brand-700", children: [user.role, " \u2022 ", user.isActive ? "Active" : "Inactive"] })] }, user._id))) }))] })] }));
}
function Card({ label, value }) {
    return (_jsxs("div", { className: "rounded-2xl border border-border bg-white p-4", children: [_jsx("p", { className: "text-sm text-slate-500", children: label }), _jsx("p", { className: "text-2xl font-bold", children: value ?? "..." })] }));
}
