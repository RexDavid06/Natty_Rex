import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "./utils";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++counter;
      setToasts((items) => [...items.slice(-3), { id, message, kind }]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur",
                item.kind === "success" && "border-lime-400/25 bg-[#151b10]/95 text-lime-100",
                item.kind === "error" && "border-red-400/25 bg-[#1c1010]/95 text-red-100",
                item.kind === "info" && "border-white/10 bg-ink-800/95 text-white/90",
              )}
            >
              {item.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
              ) : item.kind === "error" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
              )}
              <span className="flex-1 leading-snug">{item.message}</span>
              <button onClick={() => remove(item.id)} className="text-white/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
