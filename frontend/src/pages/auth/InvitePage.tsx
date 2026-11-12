import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { api, apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AuthLayout } from "../../components/layout/AppLayout";
import { Badge, Button, Field, Input, Spinner } from "../../components/ui";
import { formatDate } from "../../lib/utils";

interface Preview {
  valid: boolean;
  client_name: string;
  email_required: boolean;
  expires_at: string;
}

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { acceptInvitation } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => apiFetch<Preview>(`/auth/invitations/preview/?token=${encodeURIComponent(token)}`, { anonymous: true }),
    retry: false,
  });
  const invalid = preview.isError || preview.data?.valid === false;

  useEffect(() => {
    if (preview.data?.email_required) setEmail("");
  }, [preview.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    try {
      await acceptInvitation(token, password, preview.data?.email_required ? email : undefined);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to activate your account.");
    } finally {
      setLoading(false);
    }
  };

  if (preview.isLoading) {
    return (
      <AuthLayout>
        <div className="surface p-6">
          <Spinner label="Checking your invitation" />
        </div>
      </AuthLayout>
    );
  }

  if (invalid) {
    return (
      <AuthLayout>
        <div className="surface p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-semibold">Invitation unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/40">
            This invitation is invalid, expired, or has already been used. Ask your trainer for a new link.
          </p>
          <Link to="/login">
            <Button variant="secondary" className="mt-6">
              Go to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="surface p-6 sm:p-8">
        <div className="mb-6">
          <Badge tone="lime">
            <CheckCircle2 className="h-3 w-3" /> Invitation verified
          </Badge>
          <h1 className="mt-4 font-display text-2xl font-semibold">
            Welcome, {preview.data?.client_name?.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/40">
            Create your password to activate your Nattyrex account. This invite expires{" "}
            {formatDate(preview.data?.expires_at, { month: "short", day: "numeric" })}.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {preview.data?.email_required && (
            <Field label="Email address" hint="Your trainer registered you by phone. Add an email for sign-in.">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </Field>
          )}
          <Field label="Password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-3 rounded p-0.5 text-white/30 hover:text-white/60"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password">
            <Input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
          </Field>
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Activate account <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
