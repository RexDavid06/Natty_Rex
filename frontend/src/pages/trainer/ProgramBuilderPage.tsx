import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Copy,
  Dumbbell,
  GripVertical,
  LibraryBig,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type {
  Client,
  Exercise,
  Paginated,
  ProgramDetail,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSession,
  WorkoutWeek,
} from "../../lib/types";
import { useToast } from "../../lib/toast";
import { PageHeader } from "../../components/layout/AppLayout";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { cn, formatDate, titleCase } from "../../lib/utils";

const MUSCLE_GROUPS = [
  ["CHEST", "Chest"], ["BACK", "Back"], ["SHOULDERS", "Shoulders"], ["BICEPS", "Biceps"],
  ["TRICEPS", "Triceps"], ["LEGS", "Legs"], ["GLUTES", "Glutes"], ["CALVES", "Calves"],
  ["ABS", "Abs/Core"], ["CARDIO", "Cardio"], ["FULL_BODY", "Full body"],
];
const CATEGORIES = [
  ["STRENGTH", "Strength"], ["HYPERTROPHY", "Hypertrophy"], ["CARDIO", "Cardio"],
  ["MOBILITY", "Mobility"], ["PLYOMETRIC", "Plyometric"], ["CORE", "Core"],
];
const OBJECTIVES = [
  ["HYPERTROPHY", "Muscle building"], ["STRENGTH", "Strength"], ["WEIGHT_LOSS", "Weight loss"],
  ["ENDURANCE", "Endurance"], ["GENERAL_FITNESS", "General fitness"], ["MOBILITY", "Mobility"],
];

export function ProgramBuilderPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [weekNumber, setWeekNumber] = useState(1);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [copyDayOpen, setCopyDayOpen] = useState(false);
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [addExerciseSession, setAddExerciseSession] = useState<WorkoutSession | null>(null);
  const [editExercise, setEditExercise] = useState<WorkoutExercise | null>(null);
  const [editSession, setEditSession] = useState<WorkoutSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "session" | "exercise"; id: string; label: string } | null>(null);
  const [restConfirm, setRestConfirm] = useState(false);

  const { data: program, isLoading } = useQuery({
    queryKey: ["program", id],
    queryFn: () => api.get<ProgramDetail>(`/programs/${id}/`),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["program", id] });
    queryClient.invalidateQueries({ queryKey: ["programs"] });
  };

  const week: WorkoutWeek | undefined = program?.weeks.find((item) => item.week_number === weekNumber) ?? program?.weeks[0];
  const days = week?.days ?? [];
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0];

  useEffect(() => {
    if (!selectedDayId && days.length) setSelectedDayId(days[0].id);
  }, [days, selectedDayId]);

  const patchDay = useMutation({
    mutationFn: ({ dayId, body }: { dayId: string; body: Record<string, unknown> }) => api.patch(`/days/${dayId}/`, body),
    onSuccess: () => {
      refresh();
      toast("Day updated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update day.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) return Promise.resolve();
      const path = deleteTarget.type === "session" ? `/sessions/${deleteTarget.id}/` : `/workout-exercises/${deleteTarget.id}/`;
      return api.delete(path);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      refresh();
      toast("Removed.");
    },
    onError: () => toast("Could not remove item.", "error"),
  });

  if (isLoading || !program) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalSessions = program.weeks.reduce(
    (sum, item) => sum + item.days.reduce((count, day) => count + day.sessions.length, 0),
    0,
  );

  return (
    <div className="animate-fade-up">
      <Link to="/trainer/programs" className="mb-5 inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All programs
      </Link>
      <PageHeader
        eyebrow={`${program.objective_display} · ${program.weeks_duration} weeks`}
        title={program.name}
        subtitle={program.description || "Customize weeks, days and every exercise prescription."}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" /> Settings
            </Button>
            <Button onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-4 w-4" /> Assign clients
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="py-4">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Status</p>
          <div className="mt-1.5"><Badge tone={program.status === "ACTIVE" ? "lime" : "amber"}>{program.status}</Badge></div>
        </Card>
        <Card className="py-4">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Schedule</p>
          <p className="mt-1.5 text-sm font-semibold">{formatDate(program.start_date, { month: "short", day: "numeric" })} → {formatDate(program.end_date, { month: "short", day: "numeric" })}</p>
        </Card>
        <Card className="py-4">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Sessions</p>
          <p className="mt-1.5 text-sm font-semibold">{totalSessions}</p>
        </Card>
        <Card className="py-4">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Assigned clients</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {program.assignments.length ? (
              <>
                <div className="flex -space-x-2">
                  {program.assignments.slice(0, 4).map((assignment) => (
                    <Avatar key={assignment.id} name={assignment.client_name} size="xs" className="ring-2 ring-ink-850" />
                  ))}
                </div>
                <span className="text-xs text-white/40">{program.assigned_client_count}</span>
              </>
            ) : (
              <span className="text-xs text-white/30">None yet</span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {Array.from({ length: program.weeks_duration }).map((_, index) => {
            const number = index + 1;
            return (
              <button
                key={number}
                onClick={() => {
                  setWeekNumber(number);
                  setSelectedDayId(null);
                }}
                className={cn(
                  "shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                  weekNumber === number ? "bg-lime-400 text-ink-950" : "bg-white/[0.04] text-white/45 hover:bg-white/[0.08]",
                )}
              >
                Week {number}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCopyWeekOpen(true)}>
          <Copy className="h-3.5 w-3.5" /> Copy week
        </Button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-display text-base font-semibold">Week {weekNumber}</h2>
            <span className="text-[10px] uppercase tracking-wide text-white/25">Monday — Sunday</span>
          </div>
          <div className="space-y-2">
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  selectedDay?.id === day.id
                    ? "border-lime-400/30 bg-lime-400/[0.05]"
                    : "border-white/[0.05] bg-white/[0.015] hover:border-white/10",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-white/[0.04]">
                  <span className="text-[8px] uppercase text-white/30">{day.day_name.slice(0, 3)}</span>
                  <span className="text-[11px] font-bold text-white/70">{day.sessions.length || "–"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/80">{day.day_name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-white/30">
                    {day.is_rest_day || !day.sessions.length
                      ? "Rest day"
                      : day.sessions.map((session) => session.title).join(" · ")}
                  </p>
                </div>
                <Badge tone={day.is_rest_day || !day.sessions.length ? "neutral" : "lime"}>
                  {day.is_rest_day || !day.sessions.length ? "Rest" : `${day.sessions.reduce((n, s) => n + s.exercise_count, 0)} ex`}
                </Badge>
              </button>
            ))}
          </div>
        </Card>

        {selectedDay ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{selectedDay.day_name} · Week {weekNumber}</h2>
                <p className="mt-0.5 text-[11px] text-white/30">
                  {selectedDay.sessions.length ? `${selectedDay.sessions.length} sessions` : "Rest day"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDay.sessions.length > 0 && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setRestConfirm(true)}>
                      Mark rest
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setCopyDayOpen(true)}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => setAddSessionOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Workout
                </Button>
              </div>
            </div>

            {selectedDay.is_rest_day && !selectedDay.sessions.length ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Rest day"
                description="Give the client recovery — or add a workout to this day."
                action={<Button size="sm" variant="secondary" onClick={() => patchDay.mutate({ dayId: selectedDay.id, body: { is_rest_day: false } })}>Make training day</Button>}
                className="py-10"
              />
            ) : (
              <div className="mt-4 space-y-4">
                {selectedDay.sessions.map((session) => (
                  <SessionEditor
                    key={session.id}
                    session={session}
                    onAddExercise={() => setAddExerciseSession(session)}
                    onEditSession={() => setEditSession(session)}
                    onEditExercise={(exercise) => setEditExercise(exercise)}
                    onDelete={(target) => setDeleteTarget(target)}
                    onOrderSaved={refresh}
                  />
                ))}
              </div>
            )}
          </Card>
        ) : null}
      </div>

      <AssignClientsModal open={assignOpen} onClose={() => setAssignOpen(false)} program={program} onAssigned={refresh} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} program={program} onSaved={refresh} />
      <CopyWeekModal open={copyWeekOpen} onClose={() => setCopyWeekOpen(false)} program={program} target={week} onCopied={refresh} />
      {selectedDay && (
        <CopyDayModal open={copyDayOpen} onClose={() => setCopyDayOpen(false)} program={program} target={selectedDay} onCopied={refresh} />
      )}
      {selectedDay && (
        <AddSessionModal open={addSessionOpen} onClose={() => setAddSessionOpen(false)} day={selectedDay} onSaved={refresh} />
      )}
      {addExerciseSession && (
        <AddExerciseModal
          open={Boolean(addExerciseSession)}
          onClose={() => setAddExerciseSession(null)}
          session={addExerciseSession}
          onSaved={refresh}
        />
      )}
      <EditExerciseModal exercise={editExercise} onClose={() => setEditExercise(null)} onSaved={refresh} />
      <EditSessionModal session={editSession} onClose={() => setEditSession(null)} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Remove ${deleteTarget?.type ?? "item"}?`}
        description={deleteTarget?.label}
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={restConfirm}
        onClose={() => setRestConfirm(false)}
        onConfirm={() => {
          if (selectedDay) patchDay.mutate({ dayId: selectedDay.id, body: { is_rest_day: true } });
          setRestConfirm(false);
        }}
        loading={patchDay.isPending}
        title="Turn this into a rest day?"
        description="All workouts and exercise prescriptions on this day will be removed."
        confirmLabel="Remove workouts"
      />
    </div>
  );
}

function SessionEditor({
  session,
  onAddExercise,
  onEditSession,
  onEditExercise,
  onDelete,
  onOrderSaved,
}: {
  session: WorkoutSession;
  onAddExercise: () => void;
  onEditSession: () => void;
  onEditExercise: (exercise: WorkoutExercise) => void;
  onDelete: (target: { type: "session" | "exercise"; id: string; label: string }) => void;
  onOrderSaved: () => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<WorkoutExercise[]>(session.exercises);
  useEffect(() => setItems(session.exercises), [session.exercises]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorder = useMutation({
    mutationFn: (exerciseIds: string[]) => api.post(`/sessions/${session.id}/reorder/`, { exercise_ids: exerciseIds }),
    onSuccess: () => {
      onOrderSaved();
      toast("Exercise order saved.");
    },
    onError: () => toast("Could not save order.", "error"),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    reorder.mutate(next.map((item) => item.id));
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.012]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white/90">{session.title}</h3>
          <p className="text-[10px] text-white/25">{session.exercises.length} exercises</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEditSession} className="rounded p-1.5 text-white/30 hover:bg-white/[0.05] hover:text-white">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete({ type: "session", id: session.id, label: session.title })}
            className="rounded p-1.5 text-white/30 hover:bg-white/[0.05] hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {items.map((exercise) => (
                <SortableExercise
                  key={exercise.id}
                  exercise={exercise}
                  onEdit={() => onEditExercise(exercise)}
                  onDelete={() => onDelete({ type: "exercise", id: exercise.id, label: exercise.exercise_name })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {items.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-white/25">No exercises yet.</p>
        )}
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-center text-lime-300/80 hover:text-lime-300" onClick={onAddExercise}>
          <Plus className="h-3.5 w-3.5" /> Add exercise
        </Button>
      </div>
    </div>
  );
}

function SortableExercise({ exercise, onEdit, onDelete }: { exercise: WorkoutExercise; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-white/[0.05] bg-ink-900/60 px-2 py-2",
        isDragging && "z-20 border-lime-400/30 bg-ink-800 shadow-xl",
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-white/20 hover:text-white/45">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/30">
        {exercise.media?.kind === "VIDEO" ? <Video className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}
      </div>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-xs font-medium text-white/80">{exercise.exercise_name}</p>
        <p className="text-[10px] text-white/30">
          {exercise.sets} × {exercise.reps}
          {exercise.weight ? ` · ${exercise.weight} kg` : ""} · {exercise.rest_seconds}s rest
        </p>
      </button>
      <Badge className="hidden sm:inline-flex">{titleCase(exercise.muscle_group)}</Badge>
      <button onClick={onEdit} className="rounded p-1.5 text-white/25 hover:text-white">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={onDelete} className="rounded p-1.5 text-white/25 hover:text-red-300">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function AssignClientsModal({ open, onClose, program, onAssigned }: { open: boolean; onClose: () => void; program: ProgramDetail; onAssigned: () => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const { data } = useQuery({
    queryKey: ["clients", "assign", open],
    queryFn: () => api.get<Paginated<Client>>("/clients/?status=active&page_size=100"),
    enabled: open,
  });
  const assignedIds = new Set(program.assignments.filter((a) => a.status === "ACTIVE").map((a) => a.client_id));
  const mutation = useMutation({
    mutationFn: () => api.post<{ assignments: unknown[]; errors: { client_id: string; detail: string }[] }>(`/programs/${program.id}/assign/`, { client_ids: selected }),
    onSuccess: (result) => {
      onAssigned();
      if (result.errors.length) {
        toast(result.errors[0].detail, "error");
      } else {
        toast(`Assigned to ${selected.length} client${selected.length === 1 ? "" : "s"}.`);
        setSelected([]);
        onClose();
      }
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not assign program.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title="Assign this program" description="Select one or more active clients.">
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {data?.results.length ? (
          data.results.map((client) => {
            const already = assignedIds.has(client.id);
            return (
              <label
                key={client.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                  already ? "cursor-not-allowed border-white/[0.04] opacity-40" : "border-white/[0.07] hover:border-white/15",
                  selected.includes(client.id) && "border-lime-400/30 bg-lime-400/[0.04]",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-lime-400"
                  disabled={already}
                  checked={selected.includes(client.id)}
                  onChange={(event) =>
                    setSelected((list) =>
                      event.target.checked ? [...list, client.id] : list.filter((clientId) => clientId !== client.id),
                    )
                  }
                />
                <Avatar name={client.full_name} src={client.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white/85">{client.full_name}</p>
                  <p className="text-[10px] text-white/30">{client.email || client.phone}</p>
                </div>
                {already && <Badge tone="lime">Assigned</Badge>}
              </label>
            );
          })
        ) : (
          <EmptyState title="No active clients" description="Add a client before assigning a program." className="py-8" />
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!selected.length}>
          Assign {selected.length ? `(${selected.length})` : ""}
        </Button>
      </div>
    </Modal>
  );
}

function SettingsModal({ open, onClose, program, onSaved }: { open: boolean; onClose: () => void; program: ProgramDetail; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: program.name,
    description: program.description,
    objective: program.objective,
    start_date: program.start_date,
    end_date: program.end_date ?? "",
    weeks_duration: program.weeks_duration,
    status: program.status,
  });
  const mutation = useMutation({
    mutationFn: () => api.patch(`/programs/${program.id}/`, { ...form, end_date: form.end_date || null }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast("Program updated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update program.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title="Program settings" size="lg">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Objective">
            <Select value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
              {OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option>
            </Select>
          </Field>
          <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></Field>
          <Field label="End date"><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          <Field label="Weeks" hint="Adding weeks creates empty weeks automatically.">
            <Input type="number" min={1} max={104} value={form.weeks_duration} onChange={(e) => setForm({ ...form, weeks_duration: Number(e.target.value) })} required />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Save settings</Button>
        </div>
      </form>
    </Modal>
  );
}

function CopyWeekModal({ open, onClose, program, target, onCopied }: { open: boolean; onClose: () => void; program: ProgramDetail; target?: WorkoutWeek; onCopied: () => void }) {
  const { toast } = useToast();
  const [source, setSource] = useState("");
  useEffect(() => {
    if (open && program.weeks.length > 1) {
      setSource(program.weeks.find((week) => week.id !== target?.id)?.id ?? "");
    }
  }, [open, program.weeks, target?.id]);
  const mutation = useMutation({
    mutationFn: () => api.post(`/weeks/${target?.id}/copy/`, { source_week_id: source }),
    onSuccess: () => {
      onCopied();
      onClose();
      toast("Week copied.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not copy week.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title={`Copy into Week ${target?.week_number ?? ""}`} description="This replaces the target week's current workouts." size="sm">
      <Field label="Source week">
        <Select value={source} onChange={(event) => setSource(event.target.value)}>
          {program.weeks.filter((week) => week.id !== target?.id).map((week) => (
            <option key={week.id} value={week.id}>Week {week.week_number}</option>
          ))}
        </Select>
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!source}>Copy week</Button>
      </div>
    </Modal>
  );
}

function CopyDayModal({ open, onClose, program, target, onCopied }: { open: boolean; onClose: () => void; program: ProgramDetail; target: WorkoutDay; onCopied: () => void }) {
  const { toast } = useToast();
  const [source, setSource] = useState("");
  const options = useMemo(
    () => program.weeks.flatMap((week) => week.days.filter((day) => day.sessions.length).map((day) => ({ ...day, weekNumber: week.week_number }))),
    [program],
  );
  useEffect(() => {
    if (open) setSource(options.find((day) => day.id !== target.id)?.id ?? "");
  }, [open, options, target.id]);
  const mutation = useMutation({
    mutationFn: () => api.post(`/days/${target.id}/copy/`, { source_day_id: source }),
    onSuccess: () => {
      onCopied();
      onClose();
      toast("Workout day copied.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not copy day.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title={`Copy into ${target.day_name}`} description="Choose a training day to duplicate. Existing workouts on the target are replaced." size="sm">
      <Field label="Source day">
        <Select value={source} onChange={(event) => setSource(event.target.value)}>
          {options.filter((day) => day.id !== target.id).map((day) => (
            <option key={day.id} value={day.id}>
              Week {day.weekNumber} · {day.day_name} — {day.sessions.map((s) => s.title).join(", ")}
            </option>
          ))}
        </Select>
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!source}>Copy day</Button>
      </div>
    </Modal>
  );
}

function AddSessionModal({ open, onClose, day, onSaved }: { open: boolean; onClose: () => void; day: WorkoutDay; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (open) { setTitle(""); setNotes(""); } }, [open]);
  const mutation = useMutation({
    mutationFn: () => api.post(`/days/${day.id}/sessions/`, { title, notes }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast("Workout session added.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not add session.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title={`Add workout · ${day.day_name}`} size="sm">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <Field label="Session title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chest & Triceps" required autoFocus />
        </Field>
        <Field label="Session notes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Focus cues, intensity target…" className="min-h-[70px]" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Add session</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditSessionModal({ session, onClose, onSaved }: { session: WorkoutSession | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setNotes(session.notes);
    }
  }, [session]);
  const mutation = useMutation({
    mutationFn: () => api.patch(`/sessions/${session?.id}/`, { title, notes }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast("Session updated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update session.", "error"),
  });
  return (
    <Modal open={Boolean(session)} onClose={onClose} title="Edit workout session" size="sm">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <Field label="Session title"><Input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="Notes"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddExerciseModal({ open, onClose, session, onSaved }: { open: boolean; onClose: () => void; session: WorkoutSession; onSaved: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [rest, setRest] = useState("60");
  const [weight, setWeight] = useState("");
  const [custom, setCustom] = useState({
    exercise_name: "",
    muscle_group: "CHEST",
    category: "STRENGTH",
    instructions: "",
    sets: "3",
    reps: "10",
    rest_seconds: "60",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["exercise-library", search],
    queryFn: () => api.get<Paginated<Exercise>>(`/exercises/?page_size=100&q=${encodeURIComponent(search)}`),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelected([]);
      setTab("library");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (tab === "custom") {
        return api.post(`/sessions/${session.id}/exercises/`, {
          exercise_name: custom.exercise_name,
          muscle_group: custom.muscle_group,
          category: custom.category,
          instructions: custom.instructions,
          sets: Number(custom.sets),
          reps: custom.reps,
          rest_seconds: Number(custom.rest_seconds),
        });
      }
      for (const exerciseId of selected) {
        await api.post(`/sessions/${session.id}/exercises/`, {
          exercise_id: exerciseId,
          sets: Number(sets),
          reps,
          rest_seconds: Number(rest),
          weight: weight ? Number(weight) : null,
        });
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast(tab === "custom" ? "Exercise added." : `${selected.length} exercise${selected.length === 1 ? "" : "s"} added.`);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not add exercise.", "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Add exercises · ${session.title}`} size="lg">
      <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.03] p-1">
        <button onClick={() => setTab("library")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium", tab === "library" ? "bg-ink-700 text-white" : "text-white/35")}>
          <LibraryBig className="h-3.5 w-3.5" /> Library
        </button>
        <button onClick={() => setTab("custom")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium", tab === "custom" ? "bg-ink-700 text-white" : "text-white/35")}>
          <Plus className="h-3.5 w-3.5" /> Custom exercise
        </button>
      </div>

      {tab === "library" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercise library" className="pl-10" />
          </div>
          <div className="grid max-h-[28vh] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {isLoading ? (
              <Skeleton className="col-span-2 h-32" />
            ) : data?.results.length ? (
              data.results.map((exercise) => (
                <label key={exercise.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition", selected.includes(exercise.id) ? "border-lime-400/30 bg-lime-400/[0.05]" : "border-white/[0.05] hover:border-white/10")}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-lime-400"
                    checked={selected.includes(exercise.id)}
                    onChange={(event) => setSelected((list) => event.target.checked ? [...list, exercise.id] : list.filter((item) => item !== exercise.id))}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-white/80">{exercise.name}</p>
                    <p className="text-[9px] text-white/30">{exercise.muscle_group_display} · {exercise.default_sets}×{exercise.default_reps}</p>
                  </div>
                </label>
              ))
            ) : (
              <p className="col-span-2 py-6 text-center text-xs text-white/30">No exercises found. Create one in the library.</p>
            )}
          </div>
          {selected.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-lime-400/15 bg-lime-400/[0.03] p-3 sm:grid-cols-4">
              <Field label="Sets"><Input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} /></Field>
              <Field label="Reps"><Input value={reps} onChange={(e) => setReps(e.target.value)} /></Field>
              <Field label="Rest (s)"><Input type="number" min={0} value={rest} onChange={(e) => setRest(e.target.value)} /></Field>
              <Field label="Weight (kg)"><Input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" /></Field>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Exercise name">
            <Input value={custom.exercise_name} onChange={(event) => setCustom({ ...custom, exercise_name: event.target.value })} placeholder="Incline DB press" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Muscle group">
              <Select value={custom.muscle_group} onChange={(event) => setCustom({ ...custom, muscle_group: event.target.value })}>
                {MUSCLE_GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={custom.category} onChange={(event) => setCustom({ ...custom, category: event.target.value })}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sets"><Input type="number" min={1} value={custom.sets} onChange={(event) => setCustom({ ...custom, sets: event.target.value })} /></Field>
            <Field label="Reps"><Input value={custom.reps} onChange={(event) => setCustom({ ...custom, reps: event.target.value })} /></Field>
            <Field label="Rest (s)"><Input type="number" min={0} value={custom.rest_seconds} onChange={(event) => setCustom({ ...custom, rest_seconds: event.target.value })} /></Field>
          </div>
          <Field label="Instructions"><Textarea value={custom.instructions} onChange={(event) => setCustom({ ...custom, instructions: event.target.value })} placeholder="Technique cues and execution notes…" /></Field>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={tab === "library" ? selected.length === 0 : !custom.exercise_name.trim()}
        >
          {tab === "library" ? `Add ${selected.length || ""} exercise${selected.length === 1 ? "" : "s"}` : "Add custom exercise"}
        </Button>
      </div>
    </Modal>
  );
}

function EditExerciseModal({ exercise, onClose, onSaved }: { exercise: WorkoutExercise | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    exercise_name: "",
    muscle_group: "CHEST",
    category: "STRENGTH",
    sets: "3",
    reps: "10",
    weight: "",
    rest_seconds: "60",
    tempo: "",
    instructions: "",
    trainer_notes: "",
  });
  useEffect(() => {
    if (exercise) {
      setForm({
        exercise_name: exercise.exercise_name,
        muscle_group: exercise.muscle_group,
        category: exercise.category || "STRENGTH",
        sets: String(exercise.sets),
        reps: exercise.reps,
        weight: exercise.weight ?? "",
        rest_seconds: String(exercise.rest_seconds),
        tempo: exercise.tempo,
        instructions: exercise.instructions,
        trainer_notes: exercise.trainer_notes,
      });
    }
  }, [exercise]);
  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/workout-exercises/${exercise?.id}/`, {
        ...form,
        sets: Number(form.sets),
        rest_seconds: Number(form.rest_seconds),
        weight: form.weight ? Number(form.weight) : null,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast("Exercise prescription updated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update exercise.", "error"),
  });
  return (
    <Modal open={Boolean(exercise)} onClose={onClose} title="Edit exercise prescription" size="lg">
      <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exercise name"><Input value={form.exercise_name} onChange={(e) => setForm({ ...form, exercise_name: e.target.value })} required /></Field>
          <Field label="Muscle group">
            <Select value={form.muscle_group} onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}>
              {MUSCLE_GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Sets"><Input type="number" min={1} value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></Field>
          <Field label="Reps"><Input value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} /></Field>
          <Field label="Weight"><Input type="number" step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="—" /></Field>
          <Field label="Rest (s)"><Input type="number" min={0} value={form.rest_seconds} onChange={(e) => setForm({ ...form, rest_seconds: e.target.value })} /></Field>
          <Field label="Tempo"><Input value={form.tempo} onChange={(e) => setForm({ ...form, tempo: e.target.value })} placeholder="3-1-1" /></Field>
        </div>
        <Field label="Instructions"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
        <Field label="Trainer notes"><Textarea value={form.trainer_notes} onChange={(e) => setForm({ ...form, trainer_notes: e.target.value })} className="min-h-[70px]" /></Field>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Save prescription</Button>
        </div>
      </form>
    </Modal>
  );
}
