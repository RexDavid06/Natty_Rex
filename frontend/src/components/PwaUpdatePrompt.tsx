import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { flushLifecycleState } from "../lib/persistence/storage";
import { Button } from "./ui";

export function PwaUpdatePrompt() {
  const [offlineReadyVisible, setOfflineReadyVisible] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (document.visibilityState === "visible") void registration.update();
      }, 60 * 60_000);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    setOfflineReadyVisible(true);
    const timer = window.setTimeout(() => {
      setOfflineReadyVisible(false);
      setOfflineReady(false);
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReadyVisible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-md rounded-2xl border border-white/10 bg-ink-800/95 p-4 shadow-2xl backdrop-blur sm:bottom-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/10 text-lime-300">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {needRefresh ? "A new version is ready" : "Ready to work offline"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            {needRefresh
              ? "Update when you are between sets. Your current screen, drafts and scroll position will be restored."
              : "Nattyrex can now open without a connection. Your private API data is still never cached."}
          </p>
          {needRefresh && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  flushLifecycleState();
                  void updateServiceWorker(true);
                }}
              >
                Update now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
                Later
              </Button>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReadyVisible(false);
            setOfflineReady(false);
          }}
          className="rounded p-1 text-white/30 hover:text-white"
          aria-label="Dismiss update notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
