import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, Smartphone } from "lucide-react";
import { Button, Modal } from "./ui";
import { cn, isStandalone } from "../lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function InstallAppButton({ compact }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) {
      setInstructionsOpen(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <>
      <button
        onClick={install}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.06] text-xs font-medium text-lime-300 transition hover:bg-lime-400/10",
          compact ? "h-9 w-9 justify-center" : "px-3 py-2",
        )}
        title="Install Nattyrex"
      >
        {compact ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {!compact && "Install app"}
      </button>
      <Modal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        title="Install Nattyrex"
        description="Add the app to your home screen for full-screen, app-like access."
        size="sm"
      >
        <div className="space-y-4 px-5 pb-5 text-sm text-white/60">
          {isIOS() ? (
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  1
                </span>
                <span>
                  Open this page in <strong className="text-white">Safari</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Tap the <Share className="h-4 w-4 text-white/70" /> Share button.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  3
                </span>
                <span>
                  Scroll down and choose <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </li>
            </ol>
          ) : isAndroid() ? (
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Open the browser menu <MoreVertical className="h-4 w-4 text-white/70" />.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  2
                </span>
                <span>
                  Tap <strong className="text-white">Install app</strong> or{" "}
                  <strong className="text-white">Add to Home screen</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  3
                </span>
                <span>Confirm, then open Nattyrex from your home screen.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  1
                </span>
                <span>
                  Look for the install icon in your browser's address bar, or open the browser menu.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-lime-300">
                  2
                </span>
                <span>
                  Choose <strong className="text-white">Install Nattyrex</strong> or{" "}
                  <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </li>
            </ol>
          )}
          <Button className="w-full" onClick={() => setInstructionsOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  );
}
