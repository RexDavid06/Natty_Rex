import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dumbbell,
  ExternalLink,
  Film,
  LibraryBig,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { Exercise, ExerciseMedia, Paginated } from "../../lib/types";
import { useToast } from "../../lib/toast";
import { PageHeader } from "../../components/layout/AppLayout";
import {
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
import { titleCase } from "../../lib/utils";

const MUSCLE_GROUPS = [
  ["CHEST", "Chest"], ["BACK", "Back"], ["SHOULDERS", "Shoulders"], ["BICEPS", "Biceps"],
  ["TRICEPS", "Triceps"], ["LEGS", "Legs"], ["GLUTES", "Glutes"], ["CALVES", "Calves"],
  ["ABS", "Abs/Core"], ["CARDIO", "Cardio"], ["FULL_BODY", "Full body"],
];
const CATEGORIES = [
  ["STRENGTH", "Strength"], ["HYPERTROPHY", "Hypertrophy"], ["CARDIO", "Cardio"],
  ["MOBILITY", "Mobility"], ["PLYOMETRIC", "Plyometric"], ["CORE", "Core"],
];

const emptyForm = {
  name: "",
  muscle_group: "CHEST",
  category: "STRENGTH",
  description: "",
  instructions: "",
  default_sets: 3,
  default_reps: "10",
  default_weight: "",
  default_rest_seconds: 60,
  tempo: "",
};

export function ExercisesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [muscle, setMuscle] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [mediaExercise, setMediaExercise] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["exercises", deferredSearch, muscle],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: "100" });
      if (deferredSearch) params.set("q", deferredSearch);
      if (muscle) params.set("muscle_group", muscle);
      return api.get<Paginated<Exercise>>(`/exercises/?${params.toString()}`);
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["exercises"] });
    queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (exercise: Exercise) => {
    setEditing(exercise);
    setForm({
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      category: exercise.category,
      description: exercise.description,
      instructions: exercise.instructions,
      default_sets: exercise.default_sets,
      default_reps: exercise.default_reps,
      default_weight: exercise.default_weight ?? "",
      default_rest_seconds: exercise.default_rest_seconds,
      tempo: exercise.tempo,
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, default_weight: form.default_weight || null };
      return editing ? api.patch(`/exercises/${editing.id}/`, payload) : api.post("/exercises/", payload);
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      toast(editing ? "Exercise updated." : "Exercise added to library.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not save exercise.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/exercises/${deleteTarget?.id}/`),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast("Exercise removed from library.");
    },
    onError: () => toast("Could not delete exercise.", "error"),
  });

  const exercises = data?.results ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Reusable movement database"
        title="Exercise library"
        subtitle="Build your movement catalogue with coaching cues, animations and demonstration videos."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New exercise
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" className="pl-10" />
        </div>
        <Select value={muscle} onChange={(event) => setMuscle(event.target.value)} className="sm:w-48">
          <option value="">All muscle groups</option>
          {MUSCLE_GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-52" />)}
        </div>
      ) : exercises.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LibraryBig className="h-5 w-5" />}
            title={search || muscle ? "No matching exercises" : "Your library is empty"}
            description="Add reusable exercises once, then prescribe them across any program."
            action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add exercise</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {exercises.map((exercise) => {
            const preferred = exercise.media.find((item) => item.is_preferred) ?? exercise.media[0];
            const previewUrl = preferred?.thumbnail_url ?? (preferred?.kind !== "VIDEO" ? preferred?.url : null) ?? exercise.animation_url;
            return (
              <Card key={exercise.id} className="group p-0">
                <div className="relative h-36 overflow-hidden rounded-t-2xl bg-ink-900">
                  {previewUrl ? (
                    <img src={previewUrl} alt={exercise.name} className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
                  ) : preferred?.kind === "VIDEO" ? (
                    <video src={preferred.url ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-70" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-grid-faint text-white/15">
                      <Dumbbell className="h-9 w-9" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent px-3 pb-2 pt-8">
                    <Badge>{exercise.muscle_group_display}</Badge>
                    {preferred && (
                      <Badge tone={preferred.kind === "VIDEO" ? "blue" : "lime"}>
                        {preferred.kind === "VIDEO" ? <Video className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                        {preferred.kind === "VIDEO" ? "Video" : "Animation"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold">{exercise.name}</h3>
                      <p className="text-[10px] uppercase tracking-wide text-white/30">{exercise.category_display}</p>
                    </div>
                    <Badge tone="neutral">{exercise.default_sets}×{exercise.default_reps}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-white/35">
                    {exercise.description || exercise.instructions || "No description yet."}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3">
                    <Button size="sm" variant="ghost" onClick={() => setMediaExercise(exercise)}>
                      <Upload className="h-3.5 w-3.5" /> Media ({exercise.media.length})
                    </Button>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(exercise)} className="rounded p-1.5 text-white/25 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(exercise)} className="rounded p-1.5 text-white/25 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit exercise" : "New exercise"} size="lg">
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exercise name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Barbell back squat" required autoFocus /></Field>
            <Field label="Muscle group">
              <Select value={form.muscle_group} onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}>
                {MUSCLE_GROUPS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Tempo"><Input value={form.tempo} onChange={(e) => setForm({ ...form, tempo: e.target.value })} placeholder="3-0-1" /></Field>
          </div>
          <Field label="Short description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the movement trains and why it matters." /></Field>
          <Field label="Coaching instructions"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Setup, execution, bracing cues, common mistakes…" /></Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Sets"><Input type="number" min={1} value={form.default_sets} onChange={(e) => setForm({ ...form, default_sets: Number(e.target.value) })} /></Field>
            <Field label="Reps"><Input value={form.default_reps} onChange={(e) => setForm({ ...form, default_reps: e.target.value })} /></Field>
            <Field label="Weight"><Input type="number" step="0.5" value={form.default_weight} onChange={(e) => setForm({ ...form, default_weight: e.target.value })} placeholder="—" /></Field>
            <Field label="Rest (s)"><Input type="number" min={0} value={form.default_rest_seconds} onChange={(e) => setForm({ ...form, default_rest_seconds: Number(e.target.value) })} /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save exercise" : "Create exercise"}</Button>
          </div>
        </form>
      </Modal>

      {mediaExercise && (
        <MediaModal
          exercise={mediaExercise}
          onClose={() => setMediaExercise(null)}
          onChanged={invalidate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete exercise?"
        description={`${deleteTarget?.name ?? ""} will be removed from your library. Existing workout history keeps its exercise snapshot.`}
        confirmLabel="Delete exercise"
      />
    </div>
  );
}

function MediaModal({ exercise, onClose, onChanged }: { exercise: Exercise; onClose: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: current } = useQuery({
    queryKey: ["exercise", exercise.id],
    queryFn: () => api.get<Exercise>(`/exercises/${exercise.id}/`),
  });
  const item = current ?? exercise;
  const [form, setForm] = useState({ kind: "VIDEO", title: "", description: "", external_url: "", is_preferred: true });
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExerciseMedia | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["exercise", exercise.id] });
    onChanged();
  };

  const upload = useMutation({
    mutationFn: () => {
      const data = new FormData();
      data.append("kind", form.kind);
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("is_preferred", String(form.is_preferred));
      if (form.external_url) data.append("external_url", form.external_url);
      if (file) data.append("file", file);
      if (thumbnail) data.append("thumbnail", thumbnail);
      return api.upload(`/exercises/${exercise.id}/media/`, data);
    },
    onSuccess: () => {
      refresh();
      setForm({ kind: "VIDEO", title: "", description: "", external_url: "", is_preferred: true });
      setFile(null);
      setThumbnail(null);
      toast("Demonstration media uploaded.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not upload media.", "error"),
  });

  const setPreferred = async (media: ExerciseMedia) => {
    await api.patch(`/exercise-media/${media.id}/`, { is_preferred: true });
    refresh();
  };

  const remove = async (media: ExerciseMedia) => {
    await api.delete(`/exercise-media/${media.id}/`);
    refresh();
    toast("Media removed.");
  };

  return (
    <Modal open onClose={onClose} title={`Media · ${exercise.name}`} description="Upload an MP4 demonstration or an animated visual. Video is preferred when selected." size="lg">
      <div className="space-y-3">
        {item.media.length ? (
          item.media.map((media) => (
            <div key={media.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-3 sm:flex-row sm:items-center">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-900">
                {media.kind === "VIDEO" && media.url ? (
                  <video src={media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : media.thumbnail_url || media.url ? (
                  <img src={media.thumbnail_url ?? media.url ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/20"><Dumbbell className="h-5 w-5" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-xs font-semibold">{media.title || media.kind}</p>
                  <Badge tone={media.kind === "VIDEO" ? "blue" : "lime"}>{media.kind}</Badge>
                  {media.is_preferred && <Badge tone="lime"><Star className="h-2.5 w-2.5" /> Preferred</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-white/30">{media.description || media.external_url || "Uploaded file"}</p>
              </div>
              <div className="flex gap-1">
                {media.url && (
                  <button onClick={() => setPreview(media)} className="rounded p-1.5 text-white/30 hover:text-white" title="Preview">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
                {!media.is_preferred && (
                  <button onClick={() => setPreferred(media)} className="rounded p-1.5 text-white/30 hover:text-lime-300" title="Set preferred">
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => remove(media)} className="rounded p-1.5 text-white/30 hover:text-red-300" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState title="No demonstration media" description="Add a trainer-recorded video or an animation below." className="py-7" icon={<Film className="h-5 w-5" />} />
        )}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); upload.mutate(); }} className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
        <h3 className="text-sm font-semibold">Add demonstration</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Media type">
            <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              <option value="VIDEO">Trainer video (MP4)</option>
              <option value="ANIMATION">Animated demo (GIF/WebP/MP4)</option>
              <option value="IMAGE">Illustration</option>
            </Select>
          </Field>
          <Field label="Title"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Squat technique" /></Field>
        </div>
        <Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-[64px]" placeholder="What to watch for in this demonstration." /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Upload file" hint="MP4, GIF, WebP, JPG or PNG. Keep mobile data in mind.">
            <input type="file" accept="video/mp4,video/webm,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.07] file:px-3 file:py-2 file:text-xs file:text-white" />
          </Field>
          <Field label="Or external URL" hint="Only use media you own or have rights to host.">
            <Input type="url" value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} placeholder="https://…" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Thumbnail (optional)">
            <input type="file" accept="image/*" onChange={(event) => setThumbnail(event.target.files?.[0] ?? null)} className="block w-full text-xs text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.07] file:px-3 file:py-2 file:text-xs file:text-white" />
          </Field>
          <label className="flex items-center gap-2 self-end rounded-xl border border-white/[0.06] px-3 py-3 text-xs text-white/60">
            <input type="checkbox" checked={form.is_preferred} onChange={(event) => setForm({ ...form, is_preferred: event.target.checked })} className="h-4 w-4 accent-lime-400" />
            Use as preferred demonstration
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          <Button type="submit" loading={upload.isPending} disabled={!file && !form.external_url}>
            <Upload className="h-4 w-4" /> Upload media
          </Button>
        </div>
      </form>

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.title || "Demonstration"} size="lg">
          {preview.kind === "VIDEO" ? (
            <video src={preview.url ?? undefined} controls playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />
          ) : (
            <img src={preview.url ?? ""} alt={preview.title || "Demonstration"} className="max-h-[65vh] w-full rounded-xl object-contain" />
          )}
          {preview.description && <p className="mt-3 text-xs text-white/45">{preview.description}</p>}
        </Modal>
      )}
    </Modal>
  );
}
