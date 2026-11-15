import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { saveLastRoute } from "../lib/persistence/storage";

export function LastRouteTracker() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    saveLastRoute(user.id, user.role, `${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, user]);

  return null;
}
