import { useEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { InstallAppButton } from "../InstallApp";
import { Button } from "../ui";
import { cn } from "../../lib/utils";

type NavPage = { to: string; label: string };

const trainerPages: NavPage[] = [
  { to: "/trainer/dashboard", label: "Overview" },
  { to: "/trainer/clients", label: "Clients" },
  { to: "/trainer/programs", label: "Programs" },
  { to: "/trainer/exercises", label: "Exercises" },
  { to: "/trainer/account", label: "Account" },
];

const clientPages: NavPage[] = [
  { to: "/app", label: "Home" },
  { to: "/app/calendar", label: "Calendar" },
  { to: "/app/history", label: "History" },
  { to: "/app/progress", label: "Progress" },
  { to: "/app/account", label: "Account" },
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

function isExactOrNested(pathname: string, page: string) {
  return pathname === page || pathname.startsWith(`${page}/`);
}

function resolveSectionIndex(pathname: string, pages: NavPage[]) {
  return pages
    .map((page, index) => ({ page: page.to, index }))
    .filter(({ page }) => isExactOrNested(pathname, page))
    .sort((a, b) => b.page.length - a.page.length)[0]?.index;
}

function shouldDisableSwipe(pathname: string, pages: NavPage[]) {
  const index = resolveSectionIndex(pathname, pages);
  if (index === undefined) return true;
  const base = pages[index].to;
  // Top-level section roots can swipe; nested/detail flows (forms, active workout, etc.) cannot.
  return pathname !== base;
}

function useSwipeNavigation(pages: NavPage[], enabled: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!enabled || event.touches.length !== 1) {
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
    if (!enabled || !start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    // Require a deliberate horizontal gesture; ordinary vertical scrolling stays native.
    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    const currentIndex = resolveSectionIndex(location.pathname, pages);
    if (currentIndex === undefined) return;

    const nextPage = pages[currentIndex + (deltaX < 0 ? 1 : -1)];
    if (nextPage) navigate(nextPage.to);
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

function SectionPager({ pages, ariaLabel }: { pages: NavPage[]; ariaLabel: string }) {
  const location = useLocation();
  const currentIndex = resolveSectionIndex(location.pathname, pages);

  if (currentIndex === undefined) return null;

  return (
    <nav
      className="sticky top-0 z-40 mb-4 border-b border-white/[0.06] bg-ink-950/85 py-2 backdrop-blur-xl"
      aria-label={ariaLabel}
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pages.map((page, index) => {
          const active = index === currentIndex;
          return (
            <NavLink
              key={page.to}
              to={page.to}
              end={page.to === "/app"}
              aria-current={active ? "page" : undefined}
              data-no-swipe
              className={cn(
                "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-lime-400/30 bg-lime-400/15 text-lime-300"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white hover:bg-white/[0.06]",
              )}
            >
              {page.label}
            </NavLink>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        Section {currentIndex + 1} of {pages.length}: {pages[currentIndex].label}
      </p>
    </nav>
  );
}

export function TrainerLayout() {
  const location = useLocation();
  const swipeEnabled = !shouldDisableSwipe(location.pathname, trainerPages);
  const swipeHandlers = useSwipeNavigation(trainerPages, swipeEnabled);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <main
        {...swipeHandlers}
        className={cn(
          "mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          swipeEnabled && "touch-pan-y",
        )}
        aria-label="Trainer workspace. Swipe horizontally or use section links to move between sections."
      >
        <SectionPager pages={trainerPages} ariaLabel="Trainer sections" />
        <Outlet />
      </main>
    </div>
  );
}

export function ClientLayout() {
  const location = useLocation();
  const swipeEnabled = !shouldDisableSwipe(location.pathname, clientPages);
  const swipeHandlers = useSwipeNavigation(clientPages, swipeEnabled);
  return (
    <div className="min-h-screen">
      <OfflineBanner />
      <main
        {...swipeHandlers}
        className={cn(
          "mx-auto min-h-screen w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7",
          swipeEnabled && "touch-pan-y",
        )}
        aria-label="Client app. Swipe horizontally or use section links to move between sections."
      >
        <SectionPager pages={clientPages} ariaLabel="Client sections" />
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
