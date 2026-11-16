import { useEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { InstallAppButton } from "../InstallApp";
import { Button } from "../ui";

const trainerPages = [
  "/trainer/dashboard",
  "/trainer/clients",
  "/trainer/programs",
  "/trainer/exercises",
  "/trainer/account",
];

const clientPages = [
  "/app",
  "/app/calendar",
  "/app/history",
  "/app/progress",
  "/app/account",
];

const swipeIgnoreSelector = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "[contenteditable='true']",
  "[role='slider']",
  "[role='dialog']",
  "[data-no-swipe]",
  "[data-swipe-ignore]",
  "[data-radix-scroll-area-viewport]",
].join(", ");

function useSwipeNavigation(pages: string[]) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest(swipeIgnoreSelector)) {
      touchStart.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    // Require a deliberate horizontal gesture; ordinary vertical scrolling stays native.
    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    // Nested detail routes (e.g. client profile/workout) belong to their parent section.
    const currentIndex = pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => location.pathname === page || location.pathname.startsWith(`${page}/`))
      .sort((a, b) => b.page.length - a.page.length)[0]?.index;
    if (currentIndex === undefined) return;

    const nextPage = pages[currentIndex + (deltaX < 0 ? 1 : -1)];
    if (nextPage) navigate(nextPage);
  };

  return { onTouchStart, onTouchEnd };
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] bg-amber-400 px-4 py-1.5 text-center text-[11px] font-semibold text-ink-950">
      You are offline. Changes will not be saved until your connection returns.
    </div>
  );
}

export function TrainerLayout() {
  const swipeHandlers = useSwipeNavigation(trainerPages);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <main
        {...swipeHandlers}
        className="mx-auto min-h-screen w-full max-w-7xl touch-pan-y px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        aria-label="Trainer workspace. Swipe horizontally to move between sections."
      >
        <Outlet />
      </main>
    </div>
  );
}

export function ClientLayout() {
  const swipeHandlers = useSwipeNavigation(clientPages);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <main
        {...swipeHandlers}
        className="mx-auto min-h-screen w-full max-w-4xl touch-pan-y px-4 py-5 sm:px-6 sm:py-7"
        aria-label="Client app. Swipe horizontally to move between sections."
      >
        <Outlet />
      </main>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 grid-faint opacity-60" />
      <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-lime-400/[0.04] blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {children}
        <div className="mt-4 flex justify-center">
          <InstallAppButton />
        </div>
      </div>
    </div>
  );
}

export { Button };

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400/80">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/40">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
