import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import type { Dashboard } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/layout/AppLayout";
import { Badge, Button, Card, EmptyState, Progress, Skeleton } from "../../components/ui";
import { AddClientModal } from "../../components/trainer/AddClientModal";
import { formatDate, relativeTime } from "../../lib/utils";

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  note?: string;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-lime-400/15 bg-lime-400/[0.035]" : undefined}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
        <div className={`rounded-lg p-2 ${accent ? "bg-lime-400/10 text-lime-300" : "bg-white/[0.04] text-white/35"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="stat-value mt-3">{value}</p>
      {note && <p className="mt-1 text-[11px] text-white/30">{note}</p>}
    </Card>
  );
}

export function TrainerDashboardPage() {
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["trainer-dashboard"],
    queryFn: () => api.get<Dashboard>("/trainer/dashboard/"),
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const chartData = (data?.weekly_chart ?? []).map((item) => ({
    ...item,
    label: formatDate(item.week, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${user?.full_name?.split(" ")[0] ?? "Coach"}.`}
        subtitle="Your clients, training load and completion health at a glance."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add client
            </Button>
            <Link to="/trainer/programs">
              <Button>
                <Plus className="h-4 w-4" /> New program
              </Button>
            </Link>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[118px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Active clients" value={data?.stats.active_clients ?? 0} note={`${data?.stats.new_clients ?? 0} new this month`} icon={Users} accent />
          <StatCard label="Workouts this week" value={data?.stats.workouts_this_week ?? 0} note="Scheduled sessions" icon={Dumbbell} />
          <StatCard label="Completed" value={data?.stats.completed_this_week ?? 0} note={`${data?.stats.completion_rate ?? 0}% overall rate`} icon={CheckCircle2} />
          <StatCard label="Pending" value={data?.stats.pending_this_week ?? 0} note="Due but not logged" icon={Clock3} />
          <StatCard label="New clients" value={data?.stats.new_clients ?? 0} note="Added this month" icon={UserPlus} />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="min-h-[320px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Completion trend</h2>
              <p className="mt-0.5 text-xs text-white/35">Workouts completed over the last 6 weeks</p>
            </div>
            <Badge tone="lime">
              <Activity className="h-3 w-3" /> Live
            </Badge>
          </div>
          <div className="mt-5 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="limeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c6f94a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#c6f94a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#151815",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.45)" }}
                  itemStyle={{ color: "#c6f94a" }}
                />
                <Area type="monotone" dataKey="completed" stroke="#c6f94a" strokeWidth={2} fill="url(#limeFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent activity</h2>
            <Link to="/trainer/clients" className="text-[11px] text-white/35 hover:text-lime-300">
              View clients
            </Link>
          </div>
          <div className="mt-4 space-y-1">
            {data?.recent_activity.length ? (
              data.recent_activity.map((item, index) => (
                <Link
                  key={`${item.type}-${item.client_id}-${item.at}-${index}`}
                  to={`/trainer/clients/${item.client_id}`}
                  className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition hover:bg-white/[0.03]"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.type === "workout_completed" ? "bg-lime-400/10 text-lime-300" : "bg-white/[0.05] text-white/40"}`}>
                    {item.type === "workout_completed" ? <CalendarCheck2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">{item.client_name}</p>
                    <p className="truncate text-[11px] text-white/35">{item.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-white/25">{relativeTime(item.at)}</span>
                </Link>
              ))
            ) : (
              <EmptyState title="No activity yet" description="Client workouts will appear here as they train." className="py-8" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upcoming schedule</h2>
            <Link to="/trainer/programs" className="flex items-center gap-1 text-[11px] text-white/35 hover:text-lime-300">
              Programs <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {data?.upcoming.length ? (
              data.upcoming.map((item) => (
                <Link
                  key={`${item.session_id}-${item.client_id}`}
                  to={`/trainer/clients/${item.client_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 transition hover:border-white/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-white/[0.04]">
                      <span className="text-[8px] uppercase text-white/30">
                        {new Date(item.date).toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-xs font-bold text-white/75">{new Date(item.date).getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white/80">{item.title}</p>
                      <p className="truncate text-[10px] text-white/30">{item.client_name} · Week {item.week_number}</p>
                    </div>
                  </div>
                  <Badge>{item.date}</Badge>
                </Link>
              ))
            ) : (
              <EmptyState title="Nothing scheduled" description="Assign a program to see upcoming sessions." className="py-8" />
            )}
          </div>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-lime-400/[0.05] blur-2xl" />
          <h2 className="font-display text-lg font-semibold">This week's completion</h2>
          <p className="mt-0.5 text-xs text-white/35">Share of scheduled sessions logged</p>
          <div className="mt-6 flex items-end gap-4">
            <span className="font-display text-5xl font-semibold text-lime-400">{data?.stats.completion_rate ?? 0}%</span>
            <span className="mb-1 text-xs text-white/35">overall completion rate</span>
          </div>
          <Progress value={data?.stats.completion_rate ?? 0} className="mt-4 h-2" />
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
            <div>
              <p className="text-lg font-semibold">{data?.stats.workouts_this_week ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Scheduled</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-lime-300">{data?.stats.completed_this_week ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Done</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-amber-300">{data?.stats.pending_this_week ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Pending</p>
            </div>
          </div>
        </Card>
      </div>

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
