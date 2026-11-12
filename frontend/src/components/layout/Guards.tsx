import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth";
import { Spinner } from "../ui";

export function ProtectedRoute({ role, children }: { role?: "TRAINER" | "CLIENT"; children?: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your workspace" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "TRAINER" ? "/trainer/dashboard" : "/app"} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (user) return <Navigate to={user.role === "TRAINER" ? "/trainer/dashboard" : "/app"} replace />;
  return <>{children}</>;
}
