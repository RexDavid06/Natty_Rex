import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-lime-400 text-ink-950 shadow-[0_0_22px_rgba(198,249,74,0.25)]">
        <span className="font-display text-lg font-bold leading-none">N</span>
        <span className="absolute -right-2 -top-2 h-4 w-4 rotate-45 bg-white/25" />
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">
          NATTY<span className="text-lime-400">REX</span>
        </span>
      )}
    </Link>
  );
}
