import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Panel, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Lovable Solutions" },
      { name: "description", content: "Manage your personal details, username and password." },
      { property: "og:title", content: "My profile — Lovable Solutions" },
      { property: "og:description", content: "Personal profile and security settings." },
    ],
  }),
  component: Profile,
});

const field = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Profile() {
  const qc = useQueryClient();
  const { user, role, memberId } = useAuth();
  const [form, setForm] = useState({ full_name: "", username: "", phone: "", job_title: "" });
  const [pw, setPw] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["my-commissions", memberId],
    enabled: !!memberId,
    queryFn: async () => (await supabase.from("commissions").select("*").eq("rep_id", memberId!)).data ?? [],
  });

  const { data: myClients = [] } = useQuery({
    queryKey: ["my-clients", memberId],
    enabled: !!memberId,
    queryFn: async () =>
      (await supabase.from("clients").select("id, business_name, status").eq("onboarded_by", memberId!)).data ?? [],
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        username: profile.username ?? "",
        phone: profile.phone ?? "",
        job_title: profile.job_title ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
      if (memberId) {
        await supabase.from("team_members").update({ full_name: form.full_name, phone: form.phone }).eq("id", memberId);
      }
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      setPw("");
      toast.success("Password changed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const earned = commissions.filter((c) => c.status === "Paid").reduce((s, c) => s + Number(c.amount), 0);
  const pending = commissions.filter((c) => c.status === "Pending").reduce((s, c) => s + Number(c.amount), 0);

  return (
    <AppShell title="My profile" subtitle="Your identity, access level and personal performance.">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Personal details">
          <div className="mb-5 flex items-center gap-4">
            <span className="gradient-leaf flex size-16 items-center justify-center rounded-2xl font-display text-2xl font-semibold text-primary-foreground">
              {(form.full_name || user?.email || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-display text-lg font-semibold">{form.full_name || "Unnamed"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex gap-2">
                <Pill tone="leaf">{role ?? "…"}</Pill>
                <Pill tone="mist">Joined {fmtDate(profile?.created_at)}</Pill>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Full name
              <input className={field + " mt-1"} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Username
              <input className={field + " mt-1"} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Phone
              <input className={field + " mt-1"} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Job title
              <input className={field + " mt-1"} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            </label>
          </div>
          <button
            onClick={() => save.mutate()}
            className="gradient-leaf mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save profile
          </button>
        </Panel>

        <div className="space-y-6">
          <Panel title="My numbers">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="font-display text-xl font-semibold">{myClients.length}</p>
                <p className="text-xs text-muted-foreground">Clients</p>
              </div>
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="font-display text-sm font-semibold">{money(earned)}</p>
                <p className="text-xs text-muted-foreground">Paid out</p>
              </div>
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="font-display text-sm font-semibold">{money(pending)}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </Panel>

          <Panel title="Security">
            <p className="text-sm text-muted-foreground">Set a new password for your own account.</p>
            <input
              type="password"
              value={pw}
              minLength={8}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className={field + " mt-3"}
            />
            <button
              onClick={() => changePw.mutate()}
              disabled={pw.length < 8}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Change password
            </button>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
