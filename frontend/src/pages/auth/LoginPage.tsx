import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/api";
import { Button, Field, Input } from "../../components/ui";
import { AuthLayout } from "../../components/layout/AppLayout";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(user.role === "TRAINER" ? "/trainer/dashboard" : "/app", { replace: true });
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const account = await login(identifier.trim(), password);
      navigate(account.role === "TRAINER" ? "/trainer/dashboard" : "/app", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="surface p-6 sm:p-8">
        <div className="mb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400">
            Private coaching platform
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Welcome back.</h1>
          <p className="mt-1.5 text-sm text-white/40">
            Sign in with your email or phone number to continue training.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email or phone">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
              <Input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                className="pl-10"
                required
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-white/25" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-6 border-t border-white/[0.06] pt-4 text-center text-[11px] leading-relaxed text-white/30">
          Accounts are created by invitation only. Ask your trainer for a secure invite link.
        </p>
      </div>
      <p className="mt-5 text-center text-xs text-white/25">
        <Link to="/" className="hover:text-white/50">
          Nattyrex
        </Link>
        {" · "}Private strength coaching
      </p>
    </AuthLayout>
  );
}
