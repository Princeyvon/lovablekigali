import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    deactivated: search.deactivated === true || search.deactivated === "true",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Lovable Solutions" },
      { name: "description", content: "Sign in to the Lovable Solutions operations platform." },
      { property: "og:title", content: "Sign in — Lovable Solutions" },
      { property: "og:description", content: "Sign in to the Lovable Solutions operations platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const { deactivated } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState(""); // email or username
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // Password recovery links land here with type=recovery in the hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setMode("reset");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setBusy(true);
    try {
      let loginEmail = identifier.trim();
      if (!loginEmail.includes("@")) {
        const { data: resolved, error: resolveError } = await supabase.rpc(
          "resolve_login_email",
          { p_identifier: loginEmail },
        );
        if (resolveError || !resolved) {
          toast.error("No account found for that username.");
          return;
        }
        loginEmail = resolved as string;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Wrong email/username or password." : error.message);
        return;
      }
      toast.success("Welcome back.");
      void navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email.trim(),
          username: username.trim().toLowerCase(),
        });
      }
      if (data.session) {
        toast.success("Account created.");
        void navigate({ to: "/dashboard", replace: true });
      } else {
        toast.success("Account created — check your email to confirm, then sign in.");
        setMode("signin");
        setIdentifier(email.trim());
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset email sent — check your inbox.");
      setMode("signin");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated.");
      void navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="gradient-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="surface-card w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="gradient-leaf flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
            <Wallet className="size-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold">Lovable Solutions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Sign in to your workspace"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Choose a new password"}
          </p>
        </div>

        {deactivated ? (
          <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-xs font-medium text-destructive">
            This account has been deactivated. Contact an admin.
          </p>
        ) : null}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Email or username
              </label>
              <input
                className={inputCls}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="you@example.com or username"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  className={inputCls}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign in
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-primary hover:underline"
              >
                Create account
              </button>
            </div>
          </form>
        ) : null}

        {mode === "signup" ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Username
              </label>
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="prince"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Password
              </label>
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create account
            </button>
            <p className="text-center text-xs">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-primary hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Send reset email
            </button>
            <p className="text-center text-xs">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-primary hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                New password
              </label>
              <input
                className={inputCls}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Update password
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
