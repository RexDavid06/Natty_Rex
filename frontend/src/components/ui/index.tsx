import { forwardRef, useEffect } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn, initials } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-lime-400 text-ink-950 hover:bg-lime-300 shadow-[0_0_24px_rgba(198,249,74,0.18)]",
  secondary: "bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/[0.08]",
  ghost: "text-white/65 hover:text-white hover:bg-white/[0.06]",
  danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-400/20",
  outline: "border border-white/15 text-white hover:border-lime-400/50 hover:text-lime-300",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-sm rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "focus-ring h-11 w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 text-sm text-white placeholder:text-white/25 transition focus:border-lime-400/50",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "focus-ring min-h-[96px] w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-3 text-sm text-white placeholder:text-white/25 transition focus:border-lime-400/50",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "focus-ring h-11 w-full appearance-none rounded-xl border border-white/10 bg-ink-900/80 px-3.5 text-sm text-white transition focus:border-lime-400/50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({
  className,
  children,
  hover,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn("surface p-5", hover && "surface-hover", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "lime" | "neutral" | "red" | "amber" | "blue";
  className?: string;
}) {
  const tones = {
    lime: "bg-lime-400/10 text-lime-300 border-lime-400/20",
    neutral: "bg-white/[0.06] text-white/55 border-white/10",
    red: "bg-red-400/10 text-red-300 border-red-400/20",
    amber: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    blue: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name?: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizesMap = {
    xs: "h-7 w-7 text-[10px]",
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-lg",
    xl: "h-24 w-24 text-2xl",
  };
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Avatar"}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/10", sizesMap[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lime-400/25 to-lime-400/[0.06] font-semibold text-lime-300 ring-1 ring-lime-400/20",
        sizesMap[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function Progress({
  value,
  className,
  tone = "lime",
}: {
  value: number;
  className?: string;
  tone?: "lime" | "white";
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", tone === "lime" ? "bg-lime-400" : "bg-white/70")}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-16 text-white/40", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-lime-400" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-lime-400">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/40">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]",
        className,
      )}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const sizesMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn(
              "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-850 shadow-2xl sm:rounded-2xl",
              sizesMap[size],
            )}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.06] bg-ink-850/95 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-white/40">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="focus-ring rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  loading,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-amber-200/80">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
        <p className="text-xs leading-relaxed">
          This action changes saved training data. Review before continuing.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
