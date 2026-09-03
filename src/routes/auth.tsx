import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveLoginEmail } from "@/lib/account.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lovable Solutions" },
      { name: "description", content: "Sign in to the Lovable Solutions internal operations platform." },
      { property: "og:title", content: "Sign in — Lovable Solutions" },
      { property: "og:description", content: "Access clients, billing, vault and insights." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const field =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("One-time reset link sent to your email");
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        if (!/^[a-z0-9_.]{3,24}$/i.test(username)) {
          throw new Error("Username must be 3–24 letters, numbers, dot or underscore");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username, full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.from("profiles").upsert({
            id: data.session.user.id,
            email,
            username,
            full_name: fullName || username,
          });
          toast.success("Account created");
        } else {
          toast.success("Check your email to confirm your account");
        }
        return;
      }

      const { email: resolved } = await resolveLoginEmail({ data: { identifier: identifier.trim() } });
      const { error } = await supabase.auth.signInWithPassword({
        email: resolved.trim().toLowerCase(),
        password,
      });
      if (error) {
        throw new Error(
          error.message.toLowerCase().includes("confirm")
            ? "Confirm your email first, then sign in"
            : "Invalid username/email or password",
        );
      }
      toast.success("Welcome back");
      void navigate({ to: "/dashboard" });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gradient-page flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl shadow-[var(--shadow-rail)]">
        <div className="bg-card p-8 md:p-10">
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Internal access only.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signin" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Username or email</label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={field}
                  placeholder="aline or aline@lovable.solutions"
                />
              </div>
            )}

            {mode !== "signin" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                  placeholder="admin@lovable.solutions"
                />
              </div>
            )}

            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={field}
                    placeholder="aline"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Full name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} placeholder="Aline Uwase" />
                </div>
              </>
            )}

            {mode !== "forgot" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="gradient-leaf w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-left underline-offset-4 hover:underline"
            >
              {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
            {mode !== "forgot" && (
              <button onClick={() => setMode("forgot")} className="text-left underline-offset-4 hover:underline">
                Forgot password? Get a one-time reset link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
