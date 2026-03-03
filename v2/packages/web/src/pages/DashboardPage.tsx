import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { InspectorDashboard } from "@/components/dashboard/InspectorDashboard";
import { FullPageSpinner } from "@/components/ui/Spinner";

export function DashboardPage() {
  const { user, isLoading, isAdmin } = useCurrentUser();

  if (isLoading) return <FullPageSpinner />;
  if (!user) return null;

  return isAdmin ? <AdminDashboard /> : <InspectorDashboard />;
}
