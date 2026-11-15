import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushLifecycleState } from "../lib/persistence/storage";

const REFRESH_AFTER_BACKGROUND_MS = 5 * 60_000;
const MIN_REFRESH_GAP_MS = 30_000;

export function AppLifecycle() {
  const queryClient = useQueryClient();
  const hiddenAt = useRef<number | null>(null);
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const refreshStale = () => {
      if (!navigator.onLine) return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_REFRESH_GAP_MS) return;
      lastRefresh.current = now;
      void queryClient.refetchQueries({ type: "active", stale: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        flushLifecycleState();
        return;
      }
      const awayFor = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (awayFor >= REFRESH_AFTER_BACKGROUND_MS) refreshStale();
    };

    const onPageHide = () => {
      flushLifecycleState();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshStale();
    };

    const onOnline = () => {
      refreshStale();
    };

    const onBlur = () => {
      flushLifecycleState();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("blur", onBlur);
    };
  }, [queryClient]);

  return null;
}
