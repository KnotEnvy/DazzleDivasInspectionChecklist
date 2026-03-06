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
import { AdminPropertiesPage } from "@/routes/AdminPropertiesPage";
import { AdminSchedulePage } from "@/routes/AdminSchedulePage";
import { MySchedulePage } from "@/routes/MySchedulePage";
import { NotFoundPage } from "@/routes/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="checklists/new" element={<NewChecklistPage />} />
        <Route path="checklists/:inspectionId" element={<InspectionPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="my-schedule" element={<MySchedulePage />} />
        <Route
          path="schedule"
          element={
            <RoleGuard role="ADMIN">
              <AdminSchedulePage />
            </RoleGuard>
          }
        />
        <Route
          path="admin"
          element={
            <RoleGuard role="ADMIN">
              <AdminPage />
            </RoleGuard>
          }
        />
        <Route
          path="admin/properties"
          element={
            <RoleGuard role="ADMIN">
              <AdminPropertiesPage />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

