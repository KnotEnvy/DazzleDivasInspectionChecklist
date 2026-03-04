import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { ClipboardList, Clock3, House, Shield } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOutboxCount } from "@/hooks/useOutboxCount";
const baseLink = "rounded-xl px-3 py-2 text-sm font-semibold transition";
export function AppShell() {
    const { signOut } = useAuthActions();
    const { user, isAdmin } = useCurrentUser();
    const isOnline = useNetworkStatus();
    const { count } = useOutboxCount();
    return (_jsxs("div", { className: "mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-4 lg:px-8 lg:pb-8", children: [_jsxs("header", { className: "glass-panel mb-4 flex items-center justify-between gap-3 p-3 lg:p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-[0.2em] text-brand-700", children: "Dazzle Divas" }), _jsx("h1", { className: "text-lg font-bold lg:text-xl", children: "Field Checklist v3" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700", children: isOnline ? "Online" : "Offline" }), _jsxs("span", { className: "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700", children: ["Queue: ", count] }), _jsx("button", { className: "field-button secondary px-3", onClick: () => void signOut(), children: "Sign Out" })] })] }), _jsxs("nav", { className: "glass-panel mb-4 flex items-center gap-2 p-2", children: [_jsxs(NavLink, { to: "/", end: true, className: ({ isActive }) => `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`, children: [_jsx(House, { className: "mr-1 inline-block h-4 w-4" }), " Dashboard"] }), _jsxs(NavLink, { to: "/checklists/new", className: ({ isActive }) => `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`, children: [_jsx(ClipboardList, { className: "mr-1 inline-block h-4 w-4" }), " New Checklist"] }), _jsxs(NavLink, { to: "/history", className: ({ isActive }) => `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`, children: [_jsx(Clock3, { className: "mr-1 inline-block h-4 w-4" }), " History"] }), isAdmin && (_jsxs(NavLink, { to: "/admin", className: ({ isActive }) => `${baseLink} ${isActive ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`, children: [_jsx(Shield, { className: "mr-1 inline-block h-4 w-4" }), " Admin"] }))] }), _jsx("main", { className: "glass-panel flex-1 p-4 lg:p-6", children: _jsx(Outlet, {}) }), _jsxs("footer", { className: "mt-3 text-center text-xs text-slate-500", children: ["Signed in as ", user?.name ?? "...", " (", user?.role ?? "...", ")"] })] }));
}
