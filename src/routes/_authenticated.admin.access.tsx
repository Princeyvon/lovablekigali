import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { adminIssueOtp, adminSetRole } from "@/lib/account.functions";
import { fmtDate } from "@/lib/agency";
import { ALWAYS_ALLOWED, PAGES, PAGE_GROUPS } from "@/lib/access";
import { cn } from "@/lib/utils";

const ROLES = ["admin", "sales", "dev", "support"] as const;

const ADMIN_TABS = [
  { to: "/admin/access", label: "Access control" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({
    meta: [
      { title: "Access control — Lovable Solutions" },
      { name: "description", content: "Manage teammate roles, page permissions and account recovery." },
      { property: "og:title", content: "Access control — Lovable Solutions" },
      { property: "og:description", content: "Admin console for roles, permissions and account recovery." },
    ],
  }),
  component: AccessAdmin,
});

function AccessAdmin() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const [otp, setOtp] = useState<{ name: string; password: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

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
  const { data: access = [] } = useQuery({
    queryKey: ["page-access"],
    queryFn: async () => (await supabase.from("user_page_access").select("*")).data ?? [],
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

  const setActive = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: v.is_active }).eq("id", v.id);
      if (error) throw error;
      await supabase.from("team_members").update({ active: v.is_active }).eq("user_id", v.id);
    },
    onSuccess: () => {
      toast.success("Account updated");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPage = useMutation({
    mutationFn: async (v: { userId: string; pageKey: string; allowed: boolean }) => {
      const existing = access.find((a) => a.user_id === v.userId && a.page_key === v.pageKey);
      if (existing) {
        const { error } = await supabase
          .from("user_page_access")
          .update({ allowed: v.allowed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_page_access")
          .insert({ user_id: v.userId, page_key: v.pageKey, allowed: v.allowed });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page-access"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (v: { userId: string; allowed: boolean }) => {
      for (const p of PAGES.filter((p) => !p.adminOnly && !ALWAYS_ALLOWED.has(p.key))) {
        await setPage.mutateAsync({ userId: v.userId, pageKey: p.key, allowed: v.allowed });
      }
    },
    onSuccess: () => {
      toast.success("Permissions updated");
      qc.invalidateQueries({ queryKey: ["page-access"] });
    },
  });

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) =>
      `${p.full_name ?? ""} ${p.email ?? ""} ${p.username ?? ""}`.toLowerCase().includes(s),
    );
  }, [profiles, q]);

  const current = profiles.find((p) => p.id === selected) ?? null;
  const currentRole = current ? (roles.find((r) => r.user_id === current.id)?.role ?? "sales") : null;
  const denied = new Set(
    access.filter((a) => a.user_id === selected && !a.allowed).map((a) => a.page_key),
  );

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
      <SubTabs tabs={ADMIN_TABS} />
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

      <Panel
        title="User accounts"
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                className="h-9 w-44 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 sm:w-56"
              />
            </div>
            <Pill tone="mist">{visible.length} users</Pill>
          </div>
        }
      >
        {visible.length === 0 ? (
          <Empty>No accounts yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Person</TH>
                <TH className="hidden md:table-cell">Joined</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Manage</TH>
              </>
            }
          >
            {visible.map((p) => {
              const rowRole = roles.find((r) => r.user_id === p.id)?.role ?? "sales";
              const blocked = access.filter((a) => a.user_id === p.id && !a.allowed).length;
              return (
                <tr key={p.id} className={cn(selected === p.id && "bg-secondary/50")}>
                  <TD className="font-medium">
                    <span className="block truncate">{p.full_name || p.username || "—"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </TD>
                  <TD className="hidden md:table-cell">{fmtDate(p.created_at)}</TD>
                  <TD>
                    <select
                      value={rowRole}
                      onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value })}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs capitalize"
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
                      onClick={() => setActive.mutate({ id: p.id, is_active: !p.is_active })}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-semibold",
                        p.is_active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {p.is_active ? "Active" : "Deactivated"}
                    </button>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSelected((s) => (s === p.id ? null : p.id))}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
                      >
                        <ShieldCheck className="size-3.5" />
                        Pages{blocked ? ` (${blocked} off)` : ""}
                      </button>
                      <button
                        onClick={() => issueOtp.mutate({ userId: p.id, name: p.full_name || p.email || "User" })}
                        className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                      >
                        OTP
                      </button>
                    </div>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>

      {current ? (
        <Panel
          title={`Page permissions — ${current.full_name || current.email}`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={currentRole === "admin" ? "leaf" : "mist"}>{currentRole}</Pill>
              <button
                onClick={() => bulk.mutate({ userId: current.id, allowed: true })}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
              >
                Allow all
              </button>
              <button
                onClick={() => bulk.mutate({ userId: current.id, allowed: false })}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold"
              >
                Block all
              </button>
              <button
                onClick={() => setSelected(null)}
                className="inline-flex size-7 items-center justify-center rounded-md border border-border"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>
          }
        >
          {currentRole === "admin" ? (
            <p className="mb-4 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              Admins always see every page. Change the role first to restrict pages.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PAGE_GROUPS.map((group) => {
              const pages = PAGES.filter((p) => p.group === group);
              return (
                <div key={group} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {group}
                  </p>
                  <div className="space-y-1.5">
                    {pages.map((page) => {
                      const locked = page.adminOnly || ALWAYS_ALLOWED.has(page.key);
                      const allowed = currentRole === "admin" || locked ? !page.adminOnly || currentRole === "admin" : !denied.has(page.key);
                      return (
                        <button
                          key={page.key}
                          disabled={locked || currentRole === "admin"}
                          onClick={() =>
                            setPage.mutate({ userId: current.id, pageKey: page.key, allowed: denied.has(page.key) })
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition",
                            allowed
                              ? "border-primary/25 bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground",
                            (locked || currentRole === "admin") && "opacity-60",
                          )}
                        >
                          <span className="truncate">{page.label}</span>
                          <span
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                              allowed ? "bg-primary text-primary-foreground" : "bg-muted",
                            )}
                          >
                            {allowed ? <Check className="size-3" /> : <X className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Panel title="Team directory" right={<Pill tone="mist">{members.length} members</Pill>}>
        <Table
          head={
            <>
              <TH>Name</TH>
              <TH className="hidden sm:table-cell">Role</TH>
              <TH className="hidden lg:table-cell">Contact</TH>
              <TH>Status</TH>
            </>
          }
        >
          {members.map((m) => (
            <tr key={m.id}>
              <TD className="font-medium">
                <span className="block truncate">{m.full_name}</span>
                <span className="block truncate text-xs text-muted-foreground sm:hidden">{m.role}</span>
              </TD>
              <TD className="hidden sm:table-cell">{m.role}</TD>
              <TD className="hidden lg:table-cell">
                <span className="block truncate text-xs">{m.email ?? "—"}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.phone ?? "—"}</span>
              </TD>
              <TD>
                <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", m.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {m.active ? "Active" : "Inactive"}
                </span>
              </TD>
            </tr>
          ))}
        </Table>
      </Panel>
    </AppShell>
  );
}
