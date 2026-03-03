import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/router/AuthGuard";
import { AdminGuard } from "@/router/AdminGuard";
import { RootLayout } from "@/components/layout/RootLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NewInspectionPage } from "@/pages/NewInspectionPage";
import { InspectionDetailPage } from "@/pages/InspectionDetailPage";
import { RoomInspectionPage } from "@/pages/RoomInspectionPage";
import { UsersPage } from "@/pages/UsersPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { PropertyDetailPage } from "@/pages/PropertyDetailPage";
import { RoomTemplatesPage } from "@/pages/RoomTemplatesPage";
import { HistoryPage } from "@/pages/HistoryPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated */}
      <Route
        element={
          <AuthGuard>
            <RootLayout />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Inspector routes */}
        <Route path="/inspections/new" element={<NewInspectionPage />} />
        <Route path="/inspections/:id" element={<InspectionDetailPage />} />
        <Route
          path="/inspections/:id/rooms/:roomId"
          element={<RoomInspectionPage />}
        />

        {/* History */}
        <Route path="/history" element={<HistoryPage />} />

        {/* Admin routes */}
        <Route
          path="/admin/users"
          element={
            <AdminGuard>
              <UsersPage />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/properties"
          element={
            <AdminGuard>
              <PropertiesPage />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/properties/:id"
          element={
            <AdminGuard>
              <PropertyDetailPage />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <AdminGuard>
              <RoomTemplatesPage />
            </AdminGuard>
          }
        />
      </Route>
    </Routes>
  );
}
