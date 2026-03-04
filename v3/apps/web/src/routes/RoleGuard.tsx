import { Navigate } from "react-router-dom";
import type { UserRole } from "@dazzle/shared";
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
    return <div className="p-8 text-center text-slate-600">Loading user...</div>;
  }

  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

