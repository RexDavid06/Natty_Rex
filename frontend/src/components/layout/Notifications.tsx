import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../../lib/api";
import type { Notification, Paginated } from "../../lib/types";
import { relativeTime } from "../../lib/utils";
import { Badge } from "../ui";

export function Notifications() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Paginated<Notification>>("/auth/notifications/?page_size=30"),
    refetchInterval: 60_000,
  });
  const notifications = data?.results ?? [];
  const unread = notifications.filter((item) => !item.is_read).length;

  const markAll = useMutation({
    mutationFn: () => api.post("/auth/notifications/read-all/"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markOne = async (notification: Notification) => {
    if (!notification.is_read) {
      await api.post(`/auth/notifications/${notification.id}/read/`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-400 px-1 text-[9px] font-bold text-ink-950">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unread > 0 && <Badge tone="lime">{unread}</Badge>}
                </div>
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    className="flex items-center gap-1 text-[11px] font-medium text-white/40 hover:text-lime-300"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[22rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-white/35">You're all caught up.</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => markOne(item)}
                      className="flex w-full gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition last:border-0 hover:bg-white/[0.03]"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.is_read ? "bg-white/15" : "bg-lime-400"}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-white/85">{item.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-white/40">{item.body}</span>
                        <span className="mt-1 block text-[10px] text-white/25">{relativeTime(item.created_at)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
