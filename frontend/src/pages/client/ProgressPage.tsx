import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Plus,
  Ruler,
  Scale,
  TrendingUp,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { ProgressEntry } from "../../lib/types";
import { useToast } from "../../lib/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { formatDate } from "../../lib/utils";

const MEASUREMENTS = [
  ["chest", "Chest"], ["waist", "Waist"], ["hips", "Hips"],
  ["left_arm", "L arm"], ["right_arm", "R arm"], ["thighs", "Thighs"],
] as const;

export function ClientProgressPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client-progress"],
    queryFn: () => api.get<ProgressEntry[]>("/client/progress/"),
  });

  const entries = useMemo(
    () => [...(data ?? [])].sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [data],
  );
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];

  const delta = latest?.weight_kg && previous?.weight_kg
    ? Number(latest.weight_kg) - Number(previous.weight_kg)
    : null;

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400/80">Body tracking</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Progress</h1>
          <p className="mt-1 text-sm text-white/35">Track weight, body composition and measurements over time.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add check-in</Button>
      </div>

      {entries.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<TrendingUp className="h-5 w-5" />}
            title="Start tracking your progress"
            description="Log your first check-in. Consistent measurements reveal trends that a single weigh-in cannot."
            action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add first check-in</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3.5">
              <Scale className="h-4 w-4 text-lime-400/70" />
              <p className="mt-2 font-display text-xl font-semibold">{latest?.weight_kg ? `${latest.weight_kg}kg` : "—"}</p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wide text-white/30">Weight</p>
                {delta !== null && (
                  <span className={`inline-flex items-center text-[10px] ${delta > 0 ? "text-amber-300" : delta < 0 ? "text-lime-300" : "text-white/40"}`}>
                    {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(delta).toFixed(1)}
                  </span>
                )}
              </div>
            </Card>
            <Card className="p-3.5">
              <Activity className="h-4 w-4 text-lime-400/70" />
              <p className="mt-2 font-display text-xl font-semibold">{latest?.body_fat_percentage ? `${latest.body_fat_percentage}%` : "—"}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Body fat</p>
            </Card>
            <Card className="p-3.5">
              <Ruler className="h-4 w-4 text-lime-400/70" />
              <p className="mt-2 font-display text-xl font-semibold">{latest?.measurements?.waist ? `${latest.measurements.waist}cm` : "—"}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Waist</p>
            </Card>
            <Card className="p-3.5">
              <TrendingUp className="h-4 w-4 text-lime-400/70" />
              <p className="mt-2 font-display text-xl font-semibold">{entries.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/30">Check-ins</p>
            </Card>
          </div>

          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Weight trend</h2>
                <p className="text-[11px] text-white/30">{formatDate(entries[0].date)} – {formatDate(latest?.date)}</p>
              </div>
              <Badge tone="lime">{entries.filter((entry) => entry.weight_kg).length} data points</Badge>
            </div>
            <WeightChart entries={entries} />
          </Card>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <h2 className="font-display text-base font-semibold">Latest measurements</h2>
              <div className="mt-3 space-y-2">
                {MEASUREMENTS.map(([key, label]) => {
                  const value = latest?.measurements?.[key];
                  const prev = previous?.measurements?.[key];
                  return (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2">
                      <span className="text-[11px] text-white/45">{label}</span>
                      <div className="flex items-center gap-2">
                        {prev !== undefined && value !== undefined && Number(value) !== Number(prev) && (
                          <span className={`text-[10px] ${Number(value) < Number(prev) ? "text-lime-300/70" : "text-amber-300/70"}`}>
                            {Number(value) > Number(prev) ? "+" : ""}{(Number(value) - Number(prev)).toFixed(1)}
                          </span>
                        )}
                        <span className="text-xs font-semibold">{value !== undefined ? `${value} cm` : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-base font-semibold">Check-in log</h2>
              <div className="mt-3 max-h-[300px] space-y-1 overflow-y-auto pr-1">
                {[...entries].reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.02]">
                    <div>
                      <p className="text-xs text-white/60">{formatDate(entry.date, { month: "short", day: "numeric", year: "numeric" })}</p>
                      {entry.notes && <p className="line-clamp-1 text-[10px] text-white/25">{entry.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold">{entry.weight_kg ? `${entry.weight_kg}kg` : "—"}</p>
                      {entry.body_fat_percentage && <p className="text-[10px] text-white/30">{entry.body_fat_percentage}% BF</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <AddProgressModal
        open={open}
        onClose={() => setOpen(false)}
        existingDates={entries.map((entry) => entry.date)}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["client-progress"] }); toast("Check-in saved."); }}
      />
    </div>
  );
}

function WeightChart({ entries }: { entries: ProgressEntry[] }) {
  const points = entries
    .filter((entry) => entry.weight_kg !== null)
    .map((entry) => ({ date: entry.date, value: Number(entry.weight_kg) }));

  if (points.length < 2) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-white/[0.07] text-xs text-white/25">
        Add at least two weigh-ins to see your trend.
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const pad = { left: 34, right: 12, top: 16, bottom: 26 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = max - min || 1;
  const coords = points.map((point, index) => ({
    ...point,
    x: pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right),
    y: pad.top + ((max - point.value) / span) * (height - pad.top - pad.bottom),
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${height - pad.bottom} L${coords[0].x.toFixed(1)},${height - pad.bottom} Z`;

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full sm:h-52" role="img" aria-label="Weight trend chart">
        <defs>
          <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bef264" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#bef264" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + ratio * (height - pad.top - pad.bottom);
          const label = max - ratio * span;
          return (
            <g key={ratio}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.25)">{label.toFixed(0)}</text>
            </g>
          );
        })}
        <path d={area} fill="url(#weightArea)" />
        <path d={path} fill="none" stroke="#bef264" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#0b0f0a" stroke="#bef264" strokeWidth="2">
              <title>{`${formatDate(point.date)} · ${point.value}kg`}</title>
            </circle>
          </g>
        ))}
        <text x={pad.left} y={height - 6} fontSize="8" fill="rgba(255,255,255,0.25)">{formatDate(coords[0].date, { month: "short", day: "numeric" })}</text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.25)">{formatDate(coords[coords.length - 1].date, { month: "short", day: "numeric" })}</text>
      </svg>
    </div>
  );
}

function AddProgressModal({ open, onClose, onSaved, existingDates }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingDates: string[];
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today, weight_kg: "", body_fat_percentage: "", notes: "",
    chest: "", waist: "", hips: "", left_arm: "", right_arm: "", thighs: "",
  });

  const save = useMutation({
    mutationFn: () => {
      const measurements = MEASUREMENTS.reduce<Record<string, string>>((result, [key]) => {
        if (form[key]) result[key] = form[key];
        return result;
      }, {});
      return api.post("/client/progress/", {
        date: form.date,
        weight_kg: form.weight_kg || null,
        body_fat_percentage: form.body_fat_percentage || null,
        measurements,
        notes: form.notes,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
      setForm({ date: today, weight_kg: "", body_fat_percentage: "", notes: "", chest: "", waist: "", hips: "", left_arm: "", right_arm: "", thighs: "" });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not save check-in.", "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title="New check-in" description="Weigh yourself at the same time of day for the most consistent trend." size="lg">
      <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight_kg} onChange={(event) => setForm({ ...form, weight_kg: event.target.value })} placeholder="Optional" /></Field>
          <Field label="Body fat (%)"><Input type="number" step="0.1" min={0} max={70} value={form.body_fat_percentage} onChange={(event) => setForm({ ...form, body_fat_percentage: event.target.value })} placeholder="Optional" /></Field>
        </div>
        {existingDates.includes(form.date) && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[11px] text-amber-200/70">
            A check-in already exists for this date. Saving will replace it.
          </p>
        )}
        <div>
          <p className="mb-2 text-[11px] font-medium text-white/50">Measurements (cm)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MEASUREMENTS.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input type="number" step="0.1" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder="—" />
              </Field>
            ))}
          </div>
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Sleep, stress, nutrition, how clothes fit…" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save check-in</Button>
        </div>
      </form>
    </Modal>
  );
}
