import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Camera, KeyRound, LogOut, Save, ShieldCheck, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/types";
import { useToast } from "../lib/toast";
import { useDraftState } from "../lib/persistence/usePersistentState";
import { PageHeader } from "../components/layout/AppLayout";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "../components/ui";

export function AccountPage() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const profileInitializedFor = useRef<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const {
    value: form,
    setValue: setForm,
    restored: profileDraftRestored,
    clear: clearProfileDraft,
  } = useDraftState(`account.${user?.id ?? "anonymous"}.profile`, {
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    bio: user?.bio ?? "",
    gender: user?.gender ?? "",
    date_of_birth: user?.date_of_birth ?? "",
    fitness_goals: user?.fitness_goals ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (!user || profileDraftRestored || profileInitializedFor.current === user.id) return;
    profileInitializedFor.current = user.id;
    setForm({
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      gender: user.gender ?? "",
      date_of_birth: user.date_of_birth ?? "",
      fitness_goals: user.fitness_goals ?? "",
    });
  }, [profileDraftRestored, setForm, user]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const isClient = user?.role === "CLIENT";
  const avatarSrc = removeAvatar ? null : avatarPreview ?? user?.avatar ?? null;

  const set = (key: keyof typeof form) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const pickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const clearAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInput.current) fileInput.current.value = "";
  };

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
      };
      if (isClient) {
        payload.gender = form.gender;
        payload.date_of_birth = form.date_of_birth || null;
        payload.fitness_goals = form.fitness_goals;
      } else {
        payload.bio = form.bio;
      }
      await api.patch<User>("/auth/me/", payload);

      if (avatarFile) {
        const data = new FormData();
        data.append("avatar", avatarFile);
        await api.upload<User>("/auth/me/", data, "PATCH");
      } else if (removeAvatar) {
        const data = new FormData();
        data.append("remove_avatar", "true");
        await api.upload<User>("/auth/me/", data, "PATCH");
      }
    },
    onSuccess: async () => {
      await refreshUser();
      clearProfileDraft();
      profileInitializedFor.current = null;
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      toast("Profile updated.");
    },
    onError: (error) =>
      toast(error instanceof ApiError ? error.message : "Could not update your profile.", "error"),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.post("/auth/password/", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      }),
    onSuccess: () => {
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      toast("Password updated.");
    },
    onError: (error) =>
      toast(error instanceof ApiError ? error.message : "Could not update your password.", "error"),
  });

  const passwordsMatch =
    passwords.new_password.length > 0 && passwords.new_password === passwords.confirm_password;
  const canChangePassword =
    passwords.current_password.length > 0 &&
    passwords.new_password.length >= 8 &&
    passwordsMatch;

  if (!user) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Account"
        eyebrow="Your details"
        subtitle="Edit the personal information on your account and keep your sign-in secure."
        actions={
          <Button variant="secondary" onClick={handleSignOut} loading={signingOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <Avatar name={form.full_name || user.full_name} src={avatarSrc} size="xl" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-ink-900 text-lime-300 shadow-lg transition hover:bg-white/[0.08]"
                aria-label="Upload photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={pickAvatar}
                className="hidden"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-white">{form.full_name || user.full_name}</h2>
                <Badge tone={isClient ? "blue" : "lime"}>{isClient ? "Client" : "Trainer"}</Badge>
              </div>
              <p className="mt-1 text-xs text-white/35">
                {user.email || user.phone || "No contact details"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                  <Camera className="h-3.5 w-3.5" /> Change photo
                </Button>
                {(user.avatar || avatarPreview) && !removeAvatar && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearAvatar}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <form
            className="mt-6 space-y-4 border-t border-white/[0.06] pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              profileMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={form.full_name} onChange={set("full_name")} required />
              </Field>
              <Field label="Phone" hint="Used to sign in when no email is set.">
                <Input value={form.phone} onChange={set("phone")} inputMode="tel" />
              </Field>
              <Field
                label="Email"
                hint={
                  isClient
                    ? "Leave blank to keep signing in with your phone number."
                    : "Required for trainer sign-in."
                }
                className="sm:col-span-2"
              >
                <Input type="email" value={form.email} onChange={set("email")} />
              </Field>

              {isClient ? (
                <>
                  <Field label="Gender">
                    <Select value={form.gender} onChange={set("gender")}>
                      <option value="">Prefer not to say</option>
                      <option value="FEMALE">Female</option>
                      <option value="MALE">Male</option>
                      <option value="OTHER">Other</option>
                      <option value="PNS">Prefer not to say</option>
                    </Select>
                  </Field>
                  <Field label="Date of birth">
                    <Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
                  </Field>
                  <Field label="Fitness goals" className="sm:col-span-2">
                    <Textarea
                      value={form.fitness_goals}
                      onChange={set("fitness_goals")}
                      placeholder="What are you working towards?"
                    />
                  </Field>
                </>
              ) : (
                <Field label="Bio" hint="Shown to clients on your trainer profile." className="sm:col-span-2">
                  <Textarea
                    value={form.bio}
                    onChange={set("bio")}
                    placeholder="Certifications, coaching style, experience…"
                  />
                </Field>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                {profileDraftRestored && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearProfileDraft}>
                    Discard draft
                  </Button>
                )}
              </div>
              <Button type="submit" loading={profileMutation.isPending}>
                <Save className="h-4 w-4" /> Save changes
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-lime-400" />
              <h2 className="font-display text-base font-semibold">Change password</h2>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/35">
              Use at least 8 characters. You stay signed in after changing it.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                passwordMutation.mutate();
              }}
            >
              <Field label="Current password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current_password}
                  onChange={(event) =>
                    setPasswords({ ...passwords, current_password: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="New password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwords.new_password}
                  onChange={(event) =>
                    setPasswords({ ...passwords, new_password: event.target.value })
                  }
                  required
                />
              </Field>
              <Field
                label="Confirm new password"
                error={
                  passwords.confirm_password && !passwordsMatch
                    ? "Passwords do not match."
                    : undefined
                }
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirm_password}
                  onChange={(event) =>
                    setPasswords({ ...passwords, confirm_password: event.target.value })
                  }
                  required
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                loading={passwordMutation.isPending}
                disabled={!canChangePassword}
              >
                <ShieldCheck className="h-4 w-4" /> Update password
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold">Sign-in</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-white/35">
              {user.email
                ? `You can sign in with ${user.email}${user.phone ? ` or ${user.phone}` : ""}.`
                : `You sign in with your phone number${user.phone ? ` ${user.phone}` : ""}.`}
            </p>
            <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/35">
              Changing your email updates the address you use to sign in. Your trainer can still
              reset access for clients if needed.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
