import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
export function AuthGuard({ children }) {
    const { isAuthenticated, isLoading } = useConvexAuth();
    if (isLoading) {
        return _jsx("div", { className: "p-8 text-center text-slate-600", children: "Loading..." });
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
