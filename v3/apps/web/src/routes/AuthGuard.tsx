import { Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { LoadingQuip } from "@/components/LoadingQuip";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingQuip />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

