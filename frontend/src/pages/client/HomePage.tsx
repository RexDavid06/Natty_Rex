import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Dumbbell,
  Flame,
  Moon,
  Play,
  Target,
} from "lucide-react";
import { api } from "../../lib/api";
import type { ClientDashboard } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Badge, Button, Card, EmptyState, Progress, Skeleton } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";

const DAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

export function ClientHomePage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["client-dashboard"],
    queryFn: () => api.get<ClientDashboard>("/client/dashboard/"),
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-56" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  const today = new Date(`${data.today}T12:00:00`);
  const assignment = data.assignment;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400/80">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {greeting}, {user?.full_name?.split(" ")[0]}.
          </h1>
        </div>
        {assignment && <Badge tone="lime">{assignment.program.name}</Badge>}
      </div>

      {!assignment ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title="No program assigned yet"
            description="Your trainer is preparing your training plan. It will appear here as soon as it is assigned."
          />
        </Card>
      ) : (
        <>
          {data.today_workout ? (
            <Link to={`/app/workouts/${data.today_workout.id}`} className="group block">
              <div className="relative overflow-hidden rounded-3xl border border-lime-400/20 bg-gradient-to-br from-[#18220f] via-ink-850 to-ink-850 p-5 sm:p-7">
                <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime-400/[0.09] blur-3xl" />
                <div className="absolute inset-0 grid-faint opacity-30" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-lime-300">
                      <Flame className="h-3 w-3" /> Today's workout
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/30">
                      Week {data.today_workout.week_number} · Day {data.today_workout.day_of_week + 1}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">{data.today_workout.title}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/40">
                    <span className="inline-flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5" /> {data.today_workout.exercise_count} exercises</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(data.today_workout.scheduled_date, { weekday: "short", month: "short", day: "numeric" })}</span>
                    {data.today_workout.is_completed && (
                      <span className="inline-flex items-center gap-1.5 text-lime-300"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>
                    )}
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition group-hover:bg-lime-300">
                    {data.today_workout.is_completed ? "Review session" : "Start workout"}
                    <Play className="h-4 w-4 fill-current" />
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <Card className="relative overflow-hidden border-white/[0.08] bg-gradient-to-br from-ink-850 to-ink-900 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/40">
                  <Moon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Recovery day</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">No session scheduled today</h2>
                  <p className="mt-1 text-sm text-white/40">Use today to recover. Your next workout is waiting below.</p>
                </div>
              </div>
              {data.next_workout && (
                <Link
                  to={`/app/workouts/${data.next_workout.id}`}
                  className="mt-5 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-white/15"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-400/10 text-lime-300">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{data.next_workout.title}</p>
                    <p className="text-[10px] text-white/35">Next · {formatDate(data.next_workout.scheduled_date, { weekday: "long", month: "short", day: "numeric" })}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/25" />
                </Link>
              )}
            </Card>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "This week", value: `${data.week?.completed ?? 0}/${data.week?.total ?? 0}`, sub: "workouts", icon: Target },
              { label: "Overall", value: `${data.overall?.percentage ?? 0}%`, sub: `${data.overall?.completed_workouts ?? 0} done`, icon: CheckCircle2 },
              { label: "Program", value: `${assignment.program.weeks_duration}w`, sub: assignment.program.objective_display, icon: CalendarDays },
            ].map((stat) => (
              <Card key={stat.label} className="p-3.5 sm:p-4">
                <stat.icon className="h-4 w-4 text-lime-400/70" />
                <p className="mt-3 font-display text-xl font-semibold sm:text-2xl">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/30">{stat.label}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/25">{stat.sub}</p>
              </Card>
            ))}
          </div>

          {data.week && (
            <Card className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">Week {data.week.week_number}</h2>
                  <p className="text-[11px] text-white/30">{data.week.completed} of {data.week.total} workouts complete</p>
                </div>
                <Link to="/app/calendar">
                  <Button size="sm" variant="ghost">Calendar <ArrowRight className="h-3.5 w-3.5" /></Button>
                </Link>
              </div>
              <Progress value={data.week.total ? (data.week.completed / data.week.total) * 100 : 0} className="mt-3" />
              <div className="mt-4 space-y-1.5">
                {data.week.sessions.map((session) => {
                  const isToday = session.scheduled_date === data.today;
                  return (
                    <Link
                      key={session.id}
                      to={`/app/workouts/${session.id}`}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${isToday ? "border-lime-400/25 bg-lime-400/[0.04]" : "border-white/[0.05] hover:border-white/10"}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold ${session.is_completed ? "bg-lime-400/10 text-lime-300" : isToday ? "bg-lime-400 text-ink-950" : "bg-white/[0.04] text-white/40"}`}>
                        {session.is_completed ? <CheckCircle2 className="h-4 w-4" /> : DAY_SHORT[session.day_of_week]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white/80">{session.title}</p>
                        <p className="text-[10px] text-white/30">{formatDate(session.scheduled_date, { weekday: "short", month: "short", day: "numeric" })} · {session.exercise_count} exercises</p>
                      </div>
                      {isToday && <Badge tone="lime">Today</Badge>}
                      <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                    </Link>
                  );
                })}
                {data.week.sessions.length === 0 && <p className="py-4 text-center text-xs text-white/30">Rest week — no sessions scheduled.</p>}
              </div>
            </Card>
          )}

          {data.next_workout && data.today_workout && (
            <Card className="mt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Next up</h2>
                <Clock3 className="h-4 w-4 text-white/20" />
              </div>
              <Link to={`/app/workouts/${data.next_workout.id}`} className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/15">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-white/45">
                  <CircleDot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{data.next_workout.title}</p>
                  <p className="text-[10px] text-white/35">{formatDate(data.next_workout.scheduled_date, { weekday: "long", month: "short", day: "numeric" })} · Week {data.next_workout.week_number}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20" />
              </Link>
            </Card>
          )}

          {data.recent_history.length > 0 && (
            <Card className="mt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Recent history</h2>
                <Link to="/app/history" className="text-[11px] text-white/35 hover:text-lime-300">View all</Link>
              </div>
              <div className="mt-2 space-y-1">
                {data.recent_history.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400/70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white/70">{item.title}</p>
                      <p className="text-[10px] text-white/25">{formatDateTime(item.completed_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
