import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, MessageCircle, UserPlus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import type { Client, Invitation } from "../../lib/types";
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from "../ui";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  gender: "",
  date_of_birth: "",
  fitness_goals: "",
  training_notes: "",
};

export function InviteLink({ invitation }: { invitation: Invitation }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const link = invitation.invite_url ?? "";
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast("Invitation link copied.");
    window.setTimeout(() => setCopied(false), 1800);
  };
  const whatsapp = () => {
    const text = encodeURIComponent(
      `You're invited to Nattyrex — your private training app. Activate your account here: ${link}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="rounded-xl border border-lime-400/20 bg-lime-400/[0.04] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-400">
        Secure invitation ready
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-white/45">
        Share this single-use link. It expires in 7 days and can be regenerated anytime.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">{link}</span>
        <button onClick={copy} className="shrink-0 rounded p-1 text-white/40 hover:text-lime-300">
          {copied ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copy link
        </Button>
        <Button size="sm" variant="secondary" onClick={whatsapp}>
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </Button>
      </div>
    </div>
  );
}

export function AddClientModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [created, setCreated] = useState<Client | null>(null);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Client>("/clients/", {
        ...form,
        gender: form.gender || undefined,
        date_of_birth: form.date_of_birth || null,
        send_invitation: true,
      }),
    onSuccess: (client) => {
      setCreated(client);
      toast("Client added and invitation created.");
      onCreated?.(client);
      setForm(emptyForm);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not add client.", "error"),
  });

  const close = () => {
    setCreated(null);
    setForm(emptyForm);
    onClose();
  };

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((value) => ({ ...value, [key]: event.target.value }));

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? "Client registered" : "Add a client"}
      description={created ? "Send them the invitation to activate their account." : "Only a name and one contact method are required."}
    >
      {created ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <Avatar name={created.full_name} src={created.avatar} />
            <div>
              <p className="text-sm font-semibold">{created.full_name}</p>
              <p className="text-xs text-white/40">{created.email || created.phone}</p>
            </div>
            <span className="ml-auto rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300">
              Added
            </span>
          </div>
          {created.invitation?.invite_url ? (
            <InviteLink invitation={created.invitation} />
          ) : (
            <p className="text-xs text-white/40">Open the client profile to generate an invitation.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Full name">
            <Input value={form.full_name} onChange={set("full_name")} placeholder="Jordan Blake" required autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 010 2030" inputMode="tel" />
            </Field>
            <Field label="Email" hint="Optional if using phone">
              <Input type="email" value={form.email} onChange={set("email")} placeholder="jordan@email.com" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gender">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
            </Field>
          </div>
          <Field label="Fitness goals">
            <Textarea
              value={form.fitness_goals}
              onChange={set("fitness_goals")}
              placeholder="Build muscle, improve squat strength, train 4x/week…"
              className="min-h-[70px]"
            />
          </Field>
          <Field label="Training notes">
            <Textarea
              value={form.training_notes}
              onChange={set("training_notes")}
              placeholder="Injuries, experience level, preferences…"
              className="min-h-[70px]"
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              <UserPlus className="h-4 w-4" /> Add client & invite
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
