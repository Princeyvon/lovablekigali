import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { adminIssueOtp, adminSetRole } from "@/lib/account.functions";
import { fmtDate } from "@/lib/agency";

const ROLES = ["admin", "sales", "dev", "support"] as const;

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({
    meta: [
      { title: "Access control — Lovable Solutions" },
      { name: "description", content: "Manage teammate roles and issue one-time passwords." },
      { property: "og:title", content: "Access control — Lovable Solutions" },
      { property: "og:description", content: "Admin console for roles and account recovery." },
    ],
  }),
  component: AccessAdmin,
});

function AccessAdmin() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const [otp, setOtp] = useState<{ name: string; password: string } | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*").order("full_name")).data ?? [],
  });

  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: string }) => adminSetRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issueOtp = useMutation({
    mutationFn: (v: { userId: string; name: string }) =>
      adminIssueOtp({ data: { userId: v.userId } }).then((r) => ({ ...r, name: v.name })),
    onSuccess: (r) => {
      setOtp({ name: r.name, password: r.password });
      toast.success("One-time password generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (m: { id: string; active: boolean }) => {
      const { error } = await supabase.from("team_members").update({ active: !m.active }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member updated");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "admin") {
    return (
      <AppShell title="Access control" subtitle="Restricted area.">
        <Panel>
          <Empty>Only admins can manage access.</Empty>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Access control" subtitle="Who can see what, and how they get back in.">
      {otp && (
        <Panel title="One-time password" right={<Pill tone="warn">Share securely</Pill>}>
          <p className="text-sm text-muted-foreground">
            {otp.name} can sign in with this password once, then change it from their profile.
          </p>
          <p className="gradient-mist mt-3 rounded-xl border border-border px-4 py-3 font-mono text-lg tracking-widest">
            {otp.password}
          </p>
          <button onClick={() => setOtp(null)} className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline">
            Dismiss
          </button>
        </Panel>
      )}

      <Panel title="User accounts" right={<Pill tone="mist">{profiles.length} users</Pill>}>
        {profiles.length === 0 ? (
          <Empty>No accounts yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Person</TH>
                <TH>Username</TH>
                <TH>Joined</TH>
                <TH>Role</TH>
                <TH>Recovery</TH>
              </>
            }
          >
            {profiles.map((p) => {
              const current = roles.find((r) => r.user_id === p.id)?.role ?? "sales";
              return (
                <tr key={p.id}>
                  <TD className="font-medium">
                    {p.full_name || "—"}
                    <span className="block text-xs text-muted-foreground">{p.email}</span>
                  </TD>
                  <TD>{p.username ?? "—"}</TD>
                  <TD>{fmtDate(p.created_at)}</TD>
                  <TD>
                    <select
                      value={current}
                      onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs capitalize"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </TD>
                  <TD>
                    <button
                      onClick={() => issueOtp.mutate({ userId: p.id, name: p.full_name || p.email || "User" })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Issue OTP
                    </button>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>

      <Panel title="Team directory" right={<Pill tone="mist">{members.length} members</Pill>}>
        <Table
          head={
            <>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Email</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
            </>
          }
        >
          {members.map((m) => (
            <tr key={m.id}>
              <TD className="font-medium">{m.full_name}</TD>
              <TD>{m.role}</TD>
              <TD>{m.email ?? "—"}</TD>
              <TD>{m.phone ?? "—"}</TD>
              <TD>
                <button
                  onClick={() => toggleActive.mutate({ id: m.id, active: m.active })}
                  className="rounded-full border border-border px-3 py-1 text-xs"
                >
                  {m.active ? "Active" : "Inactive"}
                </button>
              </TD>
            </tr>
          ))}
        </Table>
      </Panel>
    </AppShell>
  );
}
