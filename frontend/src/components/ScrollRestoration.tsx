import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  readScrollPosition,
  registerLifecycleFlush,
  saveScrollPosition,
} from "../lib/persistence/storage";

const RETRY_DELAYS = [60, 160, 360, 800, 1_500];

export function ScrollRestoration() {
  const { user } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? null;
  const path = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!userId) return;
    const activePath = path;
    let cancelled = false;
    let interrupted = false;
    let frame: number | null = null;
    const timers: number[] = [];

    const persist = () => {
      saveScrollPosition(userId, activePath, window.scrollY);
    };

    const scheduleSave = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        persist();
      });
    };

    const target = readScrollPosition(userId, activePath);
    window.scrollTo({ top: target, left: 0, behavior: "auto" });

    const retry = () => {
      if (cancelled || interrupted) return;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const desired = Math.min(target, maxScroll);
      if (Math.abs(window.scrollY - desired) <= 3) return;
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
    };

    RETRY_DELAYS.forEach((delay) => {
      timers.push(window.setTimeout(retry, delay));
    });

    const interrupt = () => {
      interrupted = true;
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    const unregister = registerLifecycleFlush(persist);

    return () => {
      cancelled = true;
      persist();
      timers.forEach((timer) => window.clearTimeout(timer));
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
      unregister();
    };
  }, [path, userId]);

  return null;
}
