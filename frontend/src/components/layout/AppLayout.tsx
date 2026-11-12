import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Home,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Smartphone,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { cn, isStandalone } from "../../lib/utils";
import { Logo } from "./Logo";
import { Notifications } from "./Notifications";
import { Avatar, Button } from "../ui";

const trainerNav = [
  { to: "/trainer/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/trainer/clients", label: "Clients", icon: Users },
  { to: "/trainer/programs", label: "Programs", icon: Dumbbell },
  { to: "/trainer/exercises", label: "Exercise library", icon: LibraryBig },
];

const clientNav = [
  { to: "/app", label: "Today", icon: Home, end: true },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/history", label: "History", icon: Dumbbell },
  { to: "/app/progress", label: "Progress", icon: TrendingUp },
];

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return {
    available: Boolean(event) && !isStandalone(),
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
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

function InstallButton({ compact }: { compact?: boolean }) {
  const { available, install } = useInstallPrompt();
  if (!available) return null;
  return (
    <button
      onClick={install}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.06] text-xs font-medium text-lime-300 transition hover:bg-lime-400/10",
        compact ? "h-9 w-9 justify-center" : "px-3 py-2",
      )}
      title="Install Nattyrex"
    >
      <Smartphone className="h-4 w-4" />
      {!compact && "Install app"}
    </button>
  );
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo to="/trainer/dashboard" />
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {trainerNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-lime-400/[0.09] text-lime-300"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-40" />
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/[0.06] p-3">
        <InstallButton />
        <div className="flex items-center gap-2 rounded-xl p-2">
          <Avatar name={user?.full_name} src={user?.avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white/85">{user?.full_name}</p>
            <p className="text-[10px] uppercase tracking-wider text-lime-400/70">Trainer</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-white/30 transition hover:bg-white/[0.05] hover:text-red-300"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <OfflineBanner />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/[0.06] bg-ink-900/70 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl lg:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-white/60 hover:bg-white/[0.05]"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>
        <div className="hidden items-center gap-2 text-xs text-white/30 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
          Private trainer workspace
        </div>
        <div className="flex items-center gap-2">
          <InstallButton compact />
          <Notifications />
          <div className="hidden lg:block">
            <Avatar name={user?.full_name} src={user?.avatar} size="sm" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-16 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="relative h-full w-72 border-r border-white/10 bg-ink-900"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 z-10 rounded-lg p-2 text-white/40"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate("/login");
  };
  return (
    <div className="min-h-screen pb-24">
      <OfflineBanner />
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo to="/app" />
          <div className="flex items-center gap-2">
            <InstallButton compact />
            <Notifications />
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-white/35 transition hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <Avatar name={user?.full_name} src={user?.avatar} size="sm" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
        <Outlet />
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-900/95 px-2 pt-1.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {clientNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium transition",
                  isActive ? "text-lime-300" : "text-white/35 hover:text-white/70",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl transition",
                      isActive && "bg-lime-400/10",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
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
