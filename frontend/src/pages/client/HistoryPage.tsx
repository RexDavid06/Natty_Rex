import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2, ChevronRight, ClipboardList, Trophy } from "lucide-react";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, Skeleton } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";

interface HistoryItem {
  id: string;
  title: string;
  week_number: number;
  day_of_week: number;
  completed_at: string;
  notes: string;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ClientHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["client-history"],
    queryFn: () => api.get<HistoryItem[]>("/client/history/"),
  });

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-40" /><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  }

  const history = [...(data ?? [])].sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at));
  const months = history.reduce<Record<string, HistoryItem[]>>((groups, item) => {
    const key = new Date(item.completed_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
  const uniqueWeeks = new Set(history.map((item) => item.week_number)).size;

  return (
    <div className="animate-fade-up">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400/80">Training log</p>
      <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">History</h1>
      <p className="mt-1 text-sm text-white/35">Every completed session, saved automatically.</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Workouts", value: history.length, icon: Trophy },
          { label: "Weeks active", value: uniqueWeeks, icon: CalendarCheck2 },
          { label: "Last session", value: history[0] ? new Date(history[0].completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—", icon: ClipboardList },
        ].map((stat) => (
          <Card key={stat.label} className="p-3.5">
            <stat.icon className="h-4 w-4 text-lime-400/70" />
            <p className="mt-2 truncate font-display text-lg font-semibold sm:text-xl">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/30">{stat.label}</p>
          </Card>
        ))}
      </div>

      {history.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No completed workouts yet"
            description="Finish a session and it will be archived here with your notes and performance."
            action={<Link to="/app"><span className="text-xs text-lime-300 hover:text-lime-200">Go to today's workout →</span></Link>}
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(months).map(([month, items]) => (
            <div key={month}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">{month}</h2>
                <span className="text-[10px] text-white/20">{items.length} session{items.length === 1 ? "" : "s"}</span>
              </div>
              <Card className="divide-y divide-white/[0.05] p-0">
                {items.map((item) => (
                  <Link key={item.id} to={`/app/workouts/${item.id}`} className="flex items-center gap-3 p-3.5 transition hover:bg-white/[0.02]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/[0.08] text-lime-300">
                      <CalendarCheck2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-white/80">{item.title}</p>
                        <Badge tone="neutral">W{item.week_number}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/30">{DAY_NAMES[item.day_of_week]} · {formatDateTime(item.completed_at)}</p>
                      {item.notes && <p className="mt-0.5 line-clamp-1 text-[10px] text-white/25">{item.notes}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                  </Link>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
