import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/routes/AuthGuard";
import { RoleGuard } from "@/routes/RoleGuard";
import { LoginPage } from "@/routes/LoginPage";
import { DashboardPage } from "@/routes/DashboardPage";
import { NewChecklistPage } from "@/routes/NewChecklistPage";
import { InspectionPage } from "@/routes/InspectionPage";
import { HistoryPage } from "@/routes/HistoryPage";
import { AdminPage } from "@/routes/AdminPage";
import { NotFoundPage } from "@/routes/NotFoundPage";
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { element: _jsx(AuthGuard, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "checklists/new", element: _jsx(NewChecklistPage, {}) }), _jsx(Route, { path: "checklists/:inspectionId", element: _jsx(InspectionPage, {}) }), _jsx(Route, { path: "history", element: _jsx(HistoryPage, {}) }), _jsx(Route, { path: "admin", element: _jsx(RoleGuard, { role: "ADMIN", children: _jsx(AdminPage, {}) }) })] }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] }));
}
