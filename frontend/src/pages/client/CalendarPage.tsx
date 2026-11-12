import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Dumbbell,
  Moon,
} from "lucide-react";
import { api } from "../../lib/api";
import type { CalendarResponse, ClientAssignment } from "../../lib/types";
import { Badge, Button, Card, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/utils";

export function ClientCalendarPage() {
  const [assignmentId, setAssignmentId] = useState("");
  const [week, setWeek] = useState(1);
  const [bootstrapped, setBootstrapped] = useState(false);

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["client-assignments"],
    queryFn: () => api.get<ClientAssignment[]>("/client/assignments/"),
  });

  useEffect(() => {
    if (bootstrapped || assignments.length === 0) return;
    const latest = assignments[0];
    setAssignmentId(latest.id);
    const rawStart = new Date(latest.start_date ?? latest.assigned_at);
    const start = new Date(rawStart);
    start.setDate(rawStart.getDate() - ((rawStart.getDay() + 6) % 7));
    const elapsed = Math.floor((Date.now() - start.getTime()) / 86_400_000);
    setWeek(Math.max(1, Math.min(Math.floor(elapsed / 7) + 1, latest.program.weeks_duration)));
    setBootstrapped(true);
  }, [assignments, bootstrapped]);

  const { data, isLoading } = useQuery({
    queryKey: ["client-calendar", assignmentId, week],
    queryFn: () => api.get<CalendarResponse>(`/client/calendar/?week=${week}${assignmentId ? `&assignment=${assignmentId}` : ""}`),
    enabled: bootstrapped,
  });

  const currentWeek = data?.week_number ?? week;
  const duration = data?.weeks_duration ?? 1;

  if (loadingAssignments) return <Skeleton className="h-96" />;

  if (assignments.length === 0) {
    return (
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-semibold">Calendar</h1>
        <Card className="mt-5">
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No program yet"
            description="Once your trainer assigns a program, your weekly schedule will appear here."
          />
        </Card>
      </div>
    );
  }

  const days = data?.days ?? [];
  const firstDate = days[0]?.date;
  const lastDate = days[days.length - 1]?.date;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400/80">Training schedule</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Calendar</h1>
          <p className="mt-1 text-sm text-white/35">
            {firstDate && lastDate ? `${formatDate(firstDate, { month: "short", day: "numeric" })} – ${formatDate(lastDate, { month: "short", day: "numeric" })}` : "Your weekly plan"}
          </p>
        </div>
        {assignments.length > 1 && (
          <select
            value={assignmentId}
            onChange={(event) => { setAssignmentId(event.target.value); setWeek(1); }}
            className="rounded-xl border border-white/[0.08] bg-ink-850 px-3 py-2 text-xs text-white/70 outline-none focus:border-lime-400/40"
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>{assignment.program.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2">
        <Button size="sm" variant="ghost" onClick={() => setWeek(Math.max(1, currentWeek - 1))} disabled={currentWeek <= 1}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <div className="text-center">
          <p className="text-xs font-semibold">Week {currentWeek} <span className="text-white/25">/ {duration}</span></p>
          <p className="text-[10px] text-white/30">{data?.assignment?.program.name}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setWeek(Math.min(duration, currentWeek + 1))} disabled={currentWeek >= duration}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
      ) : (
        <div className="mt-4 grid gap-2">
          {days.map((day) => (
            <div
              key={day.id}
              className={`rounded-2xl border p-3.5 transition sm:p-4 ${day.is_today ? "border-lime-400/30 bg-lime-400/[0.035]" : "border-white/[0.06] bg-white/[0.015]"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${day.is_today ? "bg-lime-400 text-ink-950" : "bg-white/[0.04] text-white/45"}`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider">{day.day_name.slice(0, 3)}</span>
                  <span className="font-display text-sm font-bold leading-none">{new Date(`${day.date}T12:00:00`).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-white/80">{day.day_name}</p>
                    {day.is_today && <Badge tone="lime">Today</Badge>}
                    {day.is_rest_day ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-white/30"><Moon className="h-3 w-3" /> Rest day</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-white/30"><Dumbbell className="h-3 w-3" /> {day.sessions.length} session{day.sessions.length === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  {day.notes && <p className="mt-1 text-[10px] text-white/30">{day.notes}</p>}
                  {day.sessions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {day.sessions.map((session) => (
                        <Link
                          key={session.id}
                          to={`/app/workouts/${session.id}`}
                          className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-ink-900/60 px-3 py-2 transition hover:border-lime-400/25"
                        >
                          {session.is_completed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-white/20" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-white/75">{session.title}</p>
                            <p className="text-[9px] text-white/30">{session.exercise_count} exercises</p>
                          </div>
                          {session.is_completed && <Badge tone="lime">Done</Badge>}
                          <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {days.length === 0 && (
            <Card>
              <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled this week" description="This week has no training days programmed." />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
