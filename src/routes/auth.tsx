import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Agency OS" },
      { name: "description", content: "Sign in to the Agency OS internal operations platform." },
      { property: "og:title", content: "Sign in — Agency OS" },
      { property: "og:description", content: "Access clients, billing, vault and insights." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mode === "signin" ? "Welcome back" : "Account created");
  }

  return (
    <div className="gradient-page flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl shadow-[var(--shadow-rail)] md:grid-cols-2">
        <div className="gradient-rail relative hidden flex-col justify-between p-10 md:flex">
          <div className="gradient-halo pointer-events-none absolute inset-0" />
          <div className="relative">
            <p className="font-display text-2xl font-semibold text-sidebar-foreground">Agency OS</p>
            <p className="mt-3 max-w-xs text-sm text-sidebar-foreground/70">
              One source of truth for clients, credentials, billing and the people who build it all.
            </p>
          </div>
          <div className="relative space-y-3">
            {["Audited credential vault", "Multi-month billing that stays quiet", "Rep-scoped visibility"].map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                <span className="gradient-leaf size-2.5 rounded-full" />
                <span className="text-sm text-sidebar-foreground/85">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-8 md:p-10">
          <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Internal access only.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@lovable.solutions"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
