import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck2,
  Dumbbell,
  Flame,
  Mail,
  MailCheck,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError } from "../../lib/api";
import type { Client, Invitation, ProgressEntry, TrainerOverview } from "../../lib/types";
import { useToast } from "../../lib/toast";
import { Input, Textarea, Select } from "../../components/ui";
import { PageHeader } from "../../components/layout/AppLayout";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Progress,
  Skeleton,
} from "../../components/ui";
import { InviteLink } from "../../components/trainer/AddClientModal";
import { cn, formatDate, formatDateTime, pluralize, titleCase } from "../../lib/utils";

const tabs = ["Overview", "Programs", "Progress", "Notes"] as const;
type Tab = (typeof tabs)[number];

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("Overview");
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<Invitation | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["client-overview", id],
    queryFn: () => api.get<TrainerOverview>(`/clients/${id}/overview/`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["client-overview", id] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => api.post<Invitation>(`/clients/${id}/invitations/`),
    onSuccess: (invitation) => {
      setGeneratedInvite(invitation);
      refresh();
      toast("Fresh invitation link generated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not create invitation.", "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => api.delete(`/invitations/${invitationId}/`),
    onSuccess: () => {
      setGeneratedInvite(null);
      refresh();
      toast("Invitation revoked.");
    },
    onError: () => toast("Could not revoke invitation.", "error"),
  });

  const activationMutation = useMutation({
    mutationFn: (active: boolean) => api.post(`/clients/${id}/activation/`, { active }),
    onSuccess: () => {
      setDeactivateOpen(false);
      refresh();
      toast("Client status updated.");
    },
    onError: () => toast("Could not update client.", "error"),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/clients/${id}/notes/`, { body: note }),
    onSuccess: () => {
      setNote("");
      refresh();
      toast("Note saved.");
    },
    onError: () => toast("Could not save note.", "error"),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/notes/${noteId}/`),
    onSuccess: () => {
      refresh();
      toast("Note removed.");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { client, stats, assignments, history, progress, notes } = data;
  const activeInvitation = client.invitation;
  const chart = [...progress]
    .filter((entry) => entry.weight_kg)
    .reverse()
    .map((entry) => ({ date: formatDate(entry.date, { month: "short", day: "numeric" }), weight: Number(entry.weight_kg) }));

  return (
    <div className="animate-fade-up">
      <Link to="/trainer/clients" className="mb-5 inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      <PageHeader
        title={client.full_name}
        subtitle={[client.email, client.phone].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              onClick={() => {
                setGeneratedInvite(null);
                setInviteOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {client.has_account ? "New invite" : "Invite client"}
            </Button>
          </>
        }
      />

      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Avatar name={client.full_name} src={client.avatar} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={client.is_active_client ? "lime" : "neutral"}>
                {client.is_active_client ? "Active" : "Inactive"}
              </Badge>
              <Badge tone={client.has_account ? "blue" : activeInvitation ? "amber" : "neutral"}>
                {client.has_account ? "Account active" : activeInvitation ? "Invitation pending" : "Not invited"}
              </Badge>
              {client.gender && <Badge>{titleCase(client.gender)}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
              {client.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {client.phone}
                </span>
              )}
              <span>Joined {formatDate(client.created_at)}</span>
              {client.date_of_birth && <span>Born {formatDate(client.date_of_birth)}</span>}
            </div>
          </div>
          <button
            onClick={() => setDeactivateOpen(true)}
            className="self-start rounded-lg p-2 text-white/30 transition hover:bg-white/[0.05] hover:text-red-300"
            title={client.is_active_client ? "Deactivate client" : "Reactivate client"}
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-t border-white/[0.05] sm:grid-cols-4">
          {[
            { label: "Workouts", value: stats.total_workouts, icon: Dumbbell },
            { label: "Completed", value: stats.completed_workouts, icon: CalendarCheck2 },
            { label: "Completion", value: `${stats.completion_rate}%`, icon: TrendingUp },
            { label: "Streak", value: `${stats.current_streak}d`, icon: Flame },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/30">
                <item.icon className="h-3 w-3" /> {item.label}
              </p>
              <p className="mt-1 font-display text-xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto hide-scrollbar">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition",
              tab === item ? "bg-lime-400/[0.1] text-lime-300" : "text-white/40 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {item}
            {item === "Notes" && notes.length > 0 && <span className="ml-1.5 text-[10px] text-white/25">{notes.length}</span>}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <Card>
              <h2 className="font-display text-base font-semibold">Training profile</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label">Fitness goals</p>
                  <p className="text-sm leading-relaxed text-white/55">{client.fitness_goals || "No goals recorded."}</p>
                </div>
                <div>
                  <p className="label">Training notes</p>
                  <p className="text-sm leading-relaxed text-white/55">{client.training_notes || "No notes recorded."}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Recent workouts</h2>
                <span className="text-[10px] uppercase tracking-wide text-white/25">{history.length} logged</span>
              </div>
              <div className="mt-3 space-y-1">
                {history.length ? (
                  history.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg px-1 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-300">
                        <CalendarCheck2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white/80">{item.title}</p>
                        <p className="text-[10px] text-white/30">{formatDateTime(item.completed_at)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No workouts logged" description="Completed sessions will appear here." className="py-8" />
                )}
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Invitation</h2>
                <MailCheck className="h-4 w-4 text-white/25" />
              </div>
              {client.has_account ? (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-relaxed text-white/40">
                  This client has activated their account. You can generate a new secure link if they need to reset access,
                  but existing sessions remain valid.
                </div>
              ) : activeInvitation ? (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                  <p className="text-xs font-semibold text-amber-200">Invitation pending</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    Expires {formatDate(activeInvitation.expires_at)}. The original link can't be recovered; regenerate it to share again.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => inviteMutation.mutate()} loading={inviteMutation.isPending}>
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => revokeMutation.mutate(activeInvitation.id)}
                      loading={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-xs leading-relaxed text-white/40">
                    Create a single-use link so this client can set a password and start training.
                  </p>
                  <Button className="mt-3" size="sm" onClick={() => inviteMutation.mutate()} loading={inviteMutation.isPending}>
                    <UserPlus className="h-3.5 w-3.5" /> Generate invite link
                  </Button>
                </div>
              )}
              {generatedInvite?.invite_url && (
                <div className="mt-3">
                  <InviteLink invitation={generatedInvite} />
                </div>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Quick add</h2>
                <MoreHorizontal className="h-4 w-4 text-white/20" />
              </div>
              <div className="mt-3 space-y-2">
                <Button variant="secondary" className="w-full justify-start" onClick={() => setProgressOpen(true)}>
                  <Plus className="h-4 w-4" /> Record body progress
                </Button>
                <Button variant="secondary" className="w-full justify-start" onClick={() => setTab("Notes")}>
                  <Target className="h-4 w-4" /> Add trainer note
                </Button>
                <Link to={`/trainer/programs?assign=${assignments[0]?.program.id ?? ""}`}>
                  <Button variant="secondary" className="w-full justify-start">
                    <Dumbbell className="h-4 w-4" /> Manage programs
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Programs" && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Assigned programs</h2>
            <Link to="/trainer/programs">
              <Button size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" /> Assign program
              </Button>
            </Link>
          </div>
          {assignments.length ? (
            <div className="mt-4 space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{assignment.program.name}</h3>
                        <Badge tone={assignment.status === "ACTIVE" ? "lime" : "neutral"}>{assignment.status}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-white/35">
                        {assignment.program.weeks_duration} weeks · {assignment.program.objective_display} · starts{" "}
                        {formatDate(assignment.start_date ?? assignment.program.start_date)}
                      </p>
                    </div>
                    <Link to={`/trainer/programs/${assignment.program.id}`}>
                      <Button size="sm" variant="secondary">
                        Open program
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={assignment.progress.percentage} className="flex-1" />
                    <span className="text-[10px] text-white/35">
                      {assignment.progress.completed_workouts}/{assignment.progress.total_workouts}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No programs assigned" description="Build a program and assign it to this client." className="py-10" />
          )}
        </Card>
      )}

      {tab === "Progress" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold">Body weight</h2>
                <p className="text-[11px] text-white/30">Recorded measurements over time</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setProgressOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="mt-4 h-[240px]">
              {chart.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#151815", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="weight" stroke="#c6f94a" strokeWidth={2} dot={{ r: 3, fill: "#c6f94a" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Not enough data" description="Add at least two weight entries to see the trend." className="py-10" />
              )}
            </div>
          </Card>
          <Card>
            <h2 className="font-display text-base font-semibold">Recent entries</h2>
            <div className="mt-3 space-y-2">
              {progress.length ? (
                progress.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-white/[0.05] px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70">{formatDate(entry.date)}</span>
                      <span className="font-semibold text-lime-300">{entry.weight_kg ? `${entry.weight_kg} kg` : "—"}</span>
                    </div>
                    {entry.body_fat_percentage && (
                      <p className="mt-0.5 text-[10px] text-white/30">{entry.body_fat_percentage}% body fat</p>
                    )}
                    {entry.notes && <p className="mt-1 text-[10px] text-white/35">{entry.notes}</p>}
                  </div>
                ))
              ) : (
                <EmptyState title="No progress entries" className="py-8" />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "Notes" && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="font-display text-base font-semibold">Add a trainer note</h2>
            <p className="mt-1 text-[11px] text-white/30">Private to you. Clients never see these notes.</p>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Right knee tracking improving. Add tempo work next week…"
              className="mt-4"
            />
            <Button
              className="mt-3"
              onClick={() => addNote.mutate()}
              loading={addNote.isPending}
              disabled={!note.trim()}
            >
              Save note
            </Button>
          </Card>
          <Card>
            <h2 className="font-display text-base font-semibold">Notes history</h2>
            <div className="mt-4 space-y-3">
              {notes.length ? (
                notes.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/60">{item.body}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-white/25">{formatDateTime(item.created_at)}</span>
                      <button
                        onClick={() => deleteNote.mutate(item.id)}
                        className="rounded p-1 text-white/20 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No notes yet" description="Keep private coaching context here." className="py-10" />
              )}
            </div>
          </Card>
        </div>
      )}

      <EditClientModal
        client={client}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
      />
      <InviteModal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setGeneratedInvite(null);
        }}
        client={client}
        generated={generatedInvite}
        onGenerate={() => inviteMutation.mutate()}
        generating={inviteMutation.isPending}
      />
      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => activationMutation.mutate(!client.is_active_client)}
        loading={activationMutation.isPending}
        destructive={client.is_active_client}
        title={client.is_active_client ? "Deactivate this client?" : "Reactivate this client?"}
        description={
          client.is_active_client
            ? "They will no longer be able to sign in. All workout history and programs are preserved."
            : "They will be able to sign in again and see their existing assigned programs."
        }
        confirmLabel={client.is_active_client ? "Deactivate" : "Reactivate"}
      />
      <ProgressModal
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        clientId={id}
        onSaved={refresh}
      />
    </div>
  );
}

function EditClientModal({ client, open, onClose, onSaved }: { client: Client; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: client.full_name,
    email: client.email,
    phone: client.phone,
    gender: client.gender,
    date_of_birth: client.date_of_birth ?? "",
    fitness_goals: client.fitness_goals,
    training_notes: client.training_notes,
  });
  const mutation = useMutation({
    mutationFn: () => api.patch(`/clients/${client.client_id}/`, { ...form, gender: form.gender || "" }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast("Client details updated.");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update client.", "error"),
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((value) => ({ ...value, [key]: event.target.value }));
  return (
    <Modal open={open} onClose={onClose} title="Edit client" size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.full_name} onChange={set("full_name")} required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.date_of_birth ?? ""} onChange={set("date_of_birth")} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Fitness goals">
          <Textarea value={form.fitness_goals} onChange={set("fitness_goals")} />
        </Field>
        <Field label="Training notes">
          <Textarea value={form.training_notes} onChange={set("training_notes")} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InviteModal({
  open,
  onClose,
  client,
  generated,
  onGenerate,
  generating,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  generated: Invitation | null;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Client invitation" description={client.full_name}>
      {generated?.invite_url ? (
        <div className="space-y-4">
          <InviteLink invitation={generated} />
          <p className="text-[11px] leading-relaxed text-white/30">
            This link is shown once. Generating another invitation will revoke this one.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-white/45">
            {client.has_account
              ? "This client already has an account. Generating a new invitation creates a single-use activation link that can be used to set a new password."
              : "Create a secure, single-use link so your client can create a password and activate Nattyrex."}
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-white/35">
            Links expire after 7 days. Only the newest invitation remains valid.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onGenerate} loading={generating}>
              <UserPlus className="h-4 w-4" /> Generate link
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ProgressModal({ open, onClose, clientId, onSaved }: { open: boolean; onClose: () => void; clientId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), weight_kg: "", body_fat_percentage: "", notes: "" });
  const mutation = useMutation({
    mutationFn: () =>
      api.post<ProgressEntry>(`/clients/${clientId}/progress/`, {
        date: form.date,
        weight_kg: form.weight_kg || null,
        body_fat_percentage: form.body_fat_percentage || null,
        notes: form.notes,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
      setForm({ date: new Date().toISOString().slice(0, 10), weight_kg: "", body_fat_percentage: "", notes: "" });
      toast("Progress entry saved.");
    },
    onError: () => toast("Could not save progress.", "error"),
  });
  return (
    <Modal open={open} onClose={onClose} title="Record body progress" size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight (kg)">
            <Input
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={(event) => setForm({ ...form, weight_kg: event.target.value })}
              placeholder="82.5"
            />
          </Field>
          <Field label="Body fat (%)">
            <Input
              type="number"
              step="0.1"
              value={form.body_fat_percentage}
              onChange={(event) => setForm({ ...form, body_fat_percentage: event.target.value })}
              placeholder="16.2"
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className="min-h-[70px]"
            placeholder="Morning, fasted measurement…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Save entry
          </Button>
        </div>
      </form>
    </Modal>
  );
}
