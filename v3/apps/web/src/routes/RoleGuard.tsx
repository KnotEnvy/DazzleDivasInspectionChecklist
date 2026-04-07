import { Navigate } from "react-router-dom";
import type { UserRole } from "@dazzle/shared";
import { LoadingQuip } from "@/components/LoadingQuip";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function RoleGuard({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <LoadingQuip />;
  }

  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

