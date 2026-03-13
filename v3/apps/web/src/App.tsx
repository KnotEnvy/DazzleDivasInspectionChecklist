import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/routes/AuthGuard";
import { RoleGuard } from "@/routes/RoleGuard";
import { OfflineSyncProvider } from "@/app/OfflineSyncProvider";

const LoginPage = lazy(() =>
  import("@/routes/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const DashboardPage = lazy(() =>
  import("@/routes/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const NewChecklistPage = lazy(() =>
  import("@/routes/NewChecklistPage").then((module) => ({ default: module.NewChecklistPage }))
);
const ActiveInspectionsPage = lazy(() =>
  import("@/routes/ActiveInspectionsPage").then((module) => ({
    default: module.ActiveInspectionsPage,
  }))
);
const InspectionPage = lazy(() =>
  import("@/routes/InspectionPage").then((module) => ({ default: module.InspectionPage }))
);
const HistoryPage = lazy(() =>
  import("@/routes/HistoryPage").then((module) => ({ default: module.HistoryPage }))
);
const AdminPage = lazy(() =>
  import("@/routes/AdminPage").then((module) => ({ default: module.AdminPage }))
);
const AdminPropertiesPage = lazy(() =>
  import("@/routes/AdminPropertiesPage").then((module) => ({
    default: module.AdminPropertiesPage,
  }))
);
const AdminSchedulePage = lazy(() =>
  import("@/routes/AdminSchedulePage").then((module) => ({ default: module.AdminSchedulePage }))
);
const AdminTemplatesPage = lazy(() =>
  import("@/routes/AdminTemplatesPage").then((module) => ({ default: module.AdminTemplatesPage }))
);
const MySchedulePage = lazy(() =>
  import("@/routes/MySchedulePage").then((module) => ({ default: module.MySchedulePage }))
);
const NotFoundPage = lazy(() =>
  import("@/routes/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);

function RouteLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl" />
      </div>
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-24 rounded-2xl" />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={withSuspense(<LoginPage />)} />

      <Route
        element={
          <AuthGuard>
            <OfflineSyncProvider>
              <AppShell />
            </OfflineSyncProvider>
          </AuthGuard>
        }
      >
        <Route index element={withSuspense(<DashboardPage />)} />
        <Route path="checklists/new" element={withSuspense(<NewChecklistPage />)} />
        <Route path="checklists/active" element={withSuspense(<ActiveInspectionsPage />)} />
        <Route
          path="checklists/:inspectionId"
          element={withSuspense(<InspectionPage />)}
        />
        <Route path="history" element={withSuspense(<HistoryPage />)} />
        <Route path="my-schedule" element={withSuspense(<MySchedulePage />)} />
        <Route
          path="schedule"
          element={
            <RoleGuard role="ADMIN">
              {withSuspense(<AdminSchedulePage />)}
            </RoleGuard>
          }
        />
        <Route
          path="admin"
          element={
            <RoleGuard role="ADMIN">
              {withSuspense(<AdminPage />)}
            </RoleGuard>
          }
        />
        <Route
          path="admin/properties"
          element={
            <RoleGuard role="ADMIN">
              {withSuspense(<AdminPropertiesPage />)}
            </RoleGuard>
          }
        />
        <Route
          path="admin/templates"
          element={
            <RoleGuard role="ADMIN">
              {withSuspense(<AdminTemplatesPage />)}
            </RoleGuard>
          }
        />
      </Route>

      <Route path="*" element={withSuspense(<NotFoundPage />)} />
    </Routes>
  );
}
