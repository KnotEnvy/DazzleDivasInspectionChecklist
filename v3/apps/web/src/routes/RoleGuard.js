import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
export function RoleGuard({ children, role, }) {
    const { user, isLoading } = useCurrentUser();
    if (isLoading) {
        return _jsx("div", { className: "p-8 text-center text-slate-600", children: "Loading user..." });
    }
    if (!user || user.role !== role) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
