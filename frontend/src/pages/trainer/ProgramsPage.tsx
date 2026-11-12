import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Dumbbell, Plus, Search, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { Paginated, Program, ProgramDetail } from "../../lib/types";
import { PageHeader } from "../../components/layout/AppLayout";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea } from "../../components/ui";
import { useToast } from "../../lib/toast";
import { formatDate, todayISO } from "../../lib/utils";

const objectives = [
  ["HYPERTROPHY", "Muscle building"],
  ["STRENGTH", "Strength"],
  ["WEIGHT_LOSS", "Weight loss"],
  ["ENDURANCE", "Endurance"],
  ["GENERAL_FITNESS", "General fitness"],
  ["MOBILITY", "Mobility"],
];

const statusTone: Record<string, "lime" | "neutral" | "amber" | "blue"> = {
  ACTIVE: "lime",
  DRAFT: "amber",
  COMPLETED: "blue",
  ARCHIVED: "neutral",
};

export function ProgramsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["programs", deferredSearch, status],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: "50" });
      if (deferredSearch) params.set("q", deferredSearch);
      if (status) params.set("status", status);
      return api.get<Paginated<Program>>(`/programs/?${params.toString()}`);
    },
  });

  const programs = data?.results ?? [];
  const [form, setForm] = useState({
    name: "",
    objective: "HYPERTROPHY",
    description: "",
    start_date: todayISO(),
    weeks_duration: 8,
    status: "DRAFT",
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<ProgramDetail>("/programs/", form),
    onSuccess: (program) => {
      toast("Program created. Start building your weeks.");
      navigate(`/trainer/programs/${program.id}`);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not create program.", "error"),
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Workout programming"
        title="Programs"
        subtitle="Build multi-week programs, customize every day and assign to one or many clients."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New program
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs" className="pl-10" />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-44">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title={search || status ? "No matching programs" : "Build your first program"}
            description="Create a training program, shape each week, then assign it to clients."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New program</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Link key={program.id} to={`/trainer/programs/${program.id}`} className="surface surface-hover group p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/[0.08] text-lime-300">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <Badge tone={statusTone[program.status] ?? "neutral"}>{program.status}</Badge>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-white group-hover:text-lime-200">{program.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-white/35">
                {program.description || program.objective_display}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {program.weeks_duration}w
                </span>
                <span className="flex items-center gap-1">
                  <Dumbbell className="h-3 w-3" /> {program.session_count}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {program.assigned_client_count}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-white/25">Starts {formatDate(program.start_date)}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-lime-300" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a program" description="Start with the schedule. You can customize every week next.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Program name">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="8-Week Muscle Building"
              required
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Objective">
              <Select value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })}>
                {objectives.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
              </Select>
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={form.start_date}
                onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                required
              />
            </Field>
            <Field label="Weeks">
              <Input
                type="number"
                min={1}
                max={104}
                value={form.weeks_duration}
                onChange={(event) => setForm({ ...form, weeks_duration: Number(event.target.value) })}
                required
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Upper/lower split with progressive overload, 4 training days per week…"
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create & build
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
