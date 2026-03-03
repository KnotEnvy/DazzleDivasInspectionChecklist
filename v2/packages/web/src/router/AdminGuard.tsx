import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FullPageSpinner } from "@/components/ui/Spinner";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, isAdmin } = useCurrentUser();

  if (isLoading) return <FullPageSpinner />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
