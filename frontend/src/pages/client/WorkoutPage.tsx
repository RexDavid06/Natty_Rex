import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Dumbbell,
  Flame,
  Info,
  StickyNote,
  Timer,
  Trophy,
  Undo2,
  Weight,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { ClientSessionDetail, ClientWorkoutExercise } from "../../lib/types";
import { useToast } from "../../lib/toast";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Progress,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";

export function WorkoutPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [completing, setCompleting] = useState<ClientWorkoutExercise | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-session", id],
    queryFn: () => api.get<ClientSessionDetail>(`/client/sessions/${id}/`),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["client-session", id] });
    queryClient.invalidateQueries({ queryKey: ["client-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["client-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["client-history"] });
  };

  const undo = useMutation({
    mutationFn: (exercise: ClientWorkoutExercise) => api.delete(`/client/exercises/${exercise.id}/complete/`),
    onSuccess: () => { refresh(); toast("Exercise marked incomplete."); },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not undo exercise.", "error"),
  });

  const finish = useMutation({
    mutationFn: () => api.post(`/client/sessions/${id}/complete/`, { notes: workoutNotes }),
    onSuccess: () => {
      refresh();
      setFinishOpen(false);
      setWorkoutNotes("");
      toast("Workout complete. Great work.");
      navigate("/app");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not complete workout.", "error"),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }

  if (isError || !data) {
    return (
      <Card className="animate-fade-up">
        <div className="py-12 text-center">
          <p className="font-display text-lg font-semibold">Workout unavailable</p>
          <p className="mt-1 text-sm text-white/35">This workout was removed or is no longer assigned to you.</p>
          <Button className="mt-5" onClick={() => navigate("/app")}>Back to home</Button>
        </div>
      </Card>
    );
  }

  const pct = data.total_exercises ? (data.completed_exercises / data.total_exercises) * 100 : 0;
  const allDone = data.exercises.length > 0 && data.completed_exercises === data.total_exercises;

  return (
    <div className="animate-fade-up pb-24">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/35 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-ink-850 to-ink-900 p-5 sm:p-7">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime-400/[0.06] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="lime">Week {data.week_number}</Badge>
            <Badge>{data.day_name}</Badge>
            <Badge tone="neutral">{data.program_name}</Badge>
            {data.is_completed && <Badge tone="lime"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{data.title}</h1>
          <p className="mt-1 text-xs text-white/35">{formatDate(data.date, { weekday: "long", month: "long", day: "numeric" })}</p>
          {data.notes && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{data.notes}</p>}
          <div className="mt-5 flex items-center gap-3">
            <Progress value={pct} className="flex-1" />
            <span className="text-[11px] font-semibold text-white/45">{data.completed_exercises}/{data.total_exercises}</span>
          </div>
          {data.is_completed && data.completed_at && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-lime-300/80">
              <Trophy className="h-3.5 w-3.5" /> Finished {formatDateTime(data.completed_at)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Exercises</h2>
        <span className="text-[10px] uppercase tracking-wide text-white/25">Tap an exercise for coaching cues</span>
      </div>

      <div className="mt-3 space-y-3">
        {data.exercises.map((exercise, index) => {
          const isOpen = expanded === exercise.id;
          return (
            <Card key={exercise.id} className={`overflow-hidden p-0 ${exercise.is_completed ? "border-lime-400/20" : ""}`}>
              <div className="flex flex-col sm:flex-row">
                <div className="relative h-40 w-full shrink-0 bg-ink-900 sm:h-auto sm:w-48">
                  {exercise.media?.kind === "VIDEO" && exercise.media.url ? (
                    <video
                      src={exercise.media.url}
                      poster={exercise.media.thumbnail ?? undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : exercise.media?.url ? (
                    <img src={exercise.media.thumbnail ?? exercise.media.url} alt={exercise.exercise_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-grid-faint text-white/15">
                      <Dumbbell className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/80 text-[10px] font-bold text-white/70 backdrop-blur">
                    {index + 1}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-white">{exercise.exercise_name}</h3>
                      <p className="text-[10px] uppercase tracking-wide text-white/30">{exercise.muscle_group_display} · {exercise.category}</p>
                    </div>
                    {exercise.is_completed && <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-400" />}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
                      <p className="font-display text-sm font-semibold">{exercise.sets}</p>
                      <p className="text-[9px] uppercase tracking-wide text-white/25">Sets</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
                      <p className="font-display text-sm font-semibold">{exercise.reps}</p>
                      <p className="text-[9px] uppercase tracking-wide text-white/25">Reps</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
                      <p className="font-display text-sm font-semibold">{exercise.weight ? `${exercise.weight}kg` : "—"}</p>
                      <p className="text-[9px] uppercase tracking-wide text-white/25">Weight</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/30">
                    <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {exercise.rest_seconds}s rest</span>
                    {exercise.tempo && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Tempo {exercise.tempo}</span>}
                  </div>

                  {exercise.trainer_notes && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-lime-400/15 bg-lime-400/[0.04] px-2.5 py-2">
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-400/70" />
                      <p className="text-[11px] leading-relaxed text-white/55">{exercise.trainer_notes}</p>
                    </div>
                  )}

                  {exercise.is_completed && exercise.completion && (
                    <div className="mt-3 rounded-lg bg-lime-400/[0.05] px-3 py-2">
                      <p className="text-[10px] font-medium text-lime-300/80">
                        Logged {exercise.completion.actual_sets ?? exercise.sets} × {exercise.completion.actual_reps || exercise.reps}
                        {exercise.completion.actual_weight ? ` @ ${exercise.completion.actual_weight}kg` : ""}
                      </p>
                      {exercise.completion.notes && <p className="mt-0.5 text-[10px] text-white/35">{exercise.completion.notes}</p>}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <button
                      onClick={() => setExpanded(isOpen ? null : exercise.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-white/30 transition hover:text-white/60"
                    >
                      <Info className="h-3 w-3" /> {isOpen ? "Hide" : "View"} instructions
                      <ChevronDown className={`h-3 w-3 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {!data.is_completed && (
                      exercise.is_completed ? (
                        <Button size="sm" variant="ghost" onClick={() => undo.mutate(exercise)} disabled={undo.isPending}>
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setCompleting(exercise)}>
                          <Check className="h-3.5 w-3.5" /> Complete
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/[0.06] px-4 py-3">
                  {exercise.instructions ? (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-white/45">{exercise.instructions}</p>
                  ) : (
                    <p className="text-xs text-white/25">No form cues added for this movement yet.</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {data.exercises.length === 0 && (
        <Card><p className="py-8 text-center text-sm text-white/35">No exercises have been added to this session.</p></Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/90 px-4 py-3 backdrop-blur-xl md:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-[10px] text-white/35">
              <span>{data.is_completed ? "Session completed" : allDone ? "All exercises checked off" : `${data.total_exercises - data.completed_exercises} remaining`}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <Progress value={pct} className="mt-1.5" />
          </div>
          {data.is_completed ? (
            <Link to="/app"><Button size="sm" variant="secondary"><Flame className="h-4 w-4" /> Home</Button></Link>
          ) : (
            <Button size="sm" onClick={() => setFinishOpen(true)} disabled={!allDone}>
              <Trophy className="h-4 w-4" /> Finish workout
            </Button>
          )}
        </div>
      </div>

      {completing && (
        <ExerciseCompleteModal
          exercise={completing}
          onClose={() => setCompleting(null)}
          onDone={() => { setCompleting(null); refresh(); }}
        />
      )}

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish workout" description="Every exercise is checked off. Add a note for your trainer if you want.">
        <form onSubmit={(event) => { event.preventDefault(); finish.mutate(); }} className="space-y-4">
          <div className="rounded-xl border border-lime-400/20 bg-lime-400/[0.05] p-4 text-center">
            <Trophy className="mx-auto h-7 w-7 text-lime-300" />
            <p className="mt-2 font-display text-lg font-semibold">{data.title}</p>
            <p className="text-[11px] text-white/35">{data.completed_exercises} exercises · Week {data.week_number}</p>
          </div>
          <Field label="Session notes (optional)">
            <Textarea value={workoutNotes} onChange={(event) => setWorkoutNotes(event.target.value)} placeholder="Energy levels, aches, PRs, anything your trainer should know…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFinishOpen(false)}>Not yet</Button>
            <Button type="submit" loading={finish.isPending}><CheckCircle2 className="h-4 w-4" /> Complete workout</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ExerciseCompleteModal({ exercise, onClose, onDone }: { exercise: ClientWorkoutExercise; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [sets, setSets] = useState(String(exercise.sets));
  const [reps, setReps] = useState(exercise.reps);
  const [weight, setWeight] = useState(exercise.weight ?? "");
  const [notes, setNotes] = useState("");

  const complete = useMutation({
    mutationFn: () => api.post(`/client/exercises/${exercise.id}/complete/`, {
      actual_sets: Number(sets) || exercise.sets,
      actual_reps: reps,
      actual_weight: weight || null,
      notes,
    }),
    onSuccess: () => { toast(`${exercise.exercise_name} logged.`); onDone(); },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not log exercise.", "error"),
  });

  return (
    <Modal open onClose={onClose} title={exercise.exercise_name} description={`Prescribed: ${exercise.sets} × ${exercise.reps}${exercise.weight ? ` @ ${exercise.weight}kg` : ""}`}>
      <form onSubmit={(event) => { event.preventDefault(); complete.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sets done"><Input type="number" min={0} value={sets} onChange={(event) => setSets(event.target.value)} required /></Field>
          <Field label="Reps"><Input value={reps} onChange={(event) => setReps(event.target.value)} required /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.5" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="—" /></Field>
        </div>
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="How did it feel? Any form breakdown?" className="min-h-[72px]" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={complete.isPending}><Check className="h-4 w-4" /> Log exercise</Button>
        </div>
      </form>
    </Modal>
  );
}
