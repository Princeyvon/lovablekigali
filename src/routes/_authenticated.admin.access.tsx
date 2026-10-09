import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldCheck, Search, KeyRound, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Empty } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({
    meta: [
      { title: "Access Control — Lovable Solutions" },
      {
        name: "description",
        content: "Manage team roles, activation and per-page permissions.",
      },
    ],
  }),
  component: AccessControlPage,
});

const PAGE_CATALOG = [
  { group: "Manage", pages: [
    { key: "dashboard", label: "Dashboard" },
    { key: "sales.prospects", label: "Sales · Prospects" },
    { key: "sales.clients", label: "Sales · Clients" },
    { key: "sales.billing", label: "Sales · Billing" },
    { key: "apps.delivery", label: "App Status · Delivery" },
    { key: "apps.projects", label: "App Status · Projects" },
    { key: "apps.emails", label: "App Status · Emails" },
  ]},
  { group: "Operate", pages: [
    { key: "finance.team", label: "Finance · Team" },
    { key: "finance.payouts", label: "Finance · Payouts" },
    { key: "finance.expenses", label: "Finance · Expenses" },
    { key: "finance.insights", label: "Finance · Analytics" },
    { key: "library.skills", label: "Library · Skills" },
    { key: "library.inspo", label: "Library · UI Themes" },
    { key: "library.prompts", label: "Library · Prompts" },
    { key: "library.audit", label: "Library · Audit Log" },
  ]},
  { group: "Admin", pages: [
    { key: "admin.access", label: "Access Control" },
    { key: "admin.audit", label: "Audit Log" },
  ]},
] as const;

const ALL_KEYS = PAGE_CATALOG.flatMap((g) => g.pages.map((p) => p.key));
const ROLES = ["admin", "sales", "dev", "support"] as const;

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  active: boolean;
  user_id: string | null;
};

function AccessControlPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["team_members"],
    queryFn: async () =>
      ((await supabase.from("team_members").select("*").order("full_name")).data ??
        []) as Member[],
  });
  const { data: accessRows = [] } = useQuery({
    queryKey: ["user_page_access"],
    queryFn: async () => (await supabase.from("user_page_access").select("*")).data ?? [],
  });

  const filtered = useMemo(
    () =>
      members.filter(
        (m) =>
          !q ||
          m.full_name.toLowerCase().includes(q.toLowerCase()) ||
          (m.email ?? "").toLowerCase().includes(q.toLowerCase()),
      ),
    [members, q],
  );

  const selected = members.find((m) => m.id === selectedId) ?? filtered[0] ?? null;

  const accessFor = (m: Member) => {
    const key = m.user_id ?? m.id;
    return accessRows.filter((r) => r.user_id === key);
  };

  const isAllowed = (m: Member, pageKey: string) => {
    const row = accessFor(m).find((r) => r.page_key === pageKey);
    return row ? row.allowed : true; // default allow when no override exists
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["team_members"] });
    void qc.invalidateQueries({ queryKey: ["user_page_access"] });
  };

  const roleMutation = useMutation({
    mutationFn: async ({ id, nextRole }: { id: string; nextRole: string }) => {
      const { error } = await supabase.from("team_members").update({ role: nextRole }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("team_members").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.active ? "User activated" : "User deactivated");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePageMutation = useMutation({
    mutationFn: async ({ member, pageKey, allowed }: { member: Member; pageKey: string; allowed: boolean }) => {
      const userKey = member.user_id ?? member.id;
      const { error } = await supabase.from("user_page_access").upsert(
        { user_id: userKey, page_key: pageKey, allowed },
        { onConflict: "user_id,page_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const setAllMutation = useMutation({
    mutationFn: async ({ member, allowed }: { member: Member; allowed: boolean }) => {
      const userKey = member.user_id ?? member.id;
      const rows = ALL_KEYS.map((k) => ({ user_id: userKey, page_key: k, allowed }));
      const { error } = await supabase
        .from("user_page_access")
        .upsert(rows, { onConflict: "user_id,page_key" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.allowed ? "All pages allowed" : "All pages blocked");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendOtp = async (member: Member) => {
    if (!member.email) {
      toast.error("This user has no email on record");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(member.email);
    if (error) toast.error(error.message);
    else toast.success(`One-time password email sent to ${member.email}`);
  };

  if (role !== "admin") {
    return (
      <AppShell title="Access Control">
        <Panel>
          <Empty icon={ShieldCheck} text="Only admins can manage access control." />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Access Control"
      subtitle="Roles, activation and per-page permissions for every team member."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel
          title="Team members"
          right={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-36 rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          }
        >
          {!filtered.length ? (
            <Empty icon={ShieldCheck} text="No team members found." />
          ) : (
            <ul className="-mx-2 divide-y divide-border">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition",
                      selected?.id === m.id ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <span className="gradient-leaf flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground">
                      {m.full_name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.email ?? "no email"}
                      </span>
                    </span>
                    <Pill tone={m.active ? "leaf" : "warn"}>{m.active ? "active" : "off"}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          {!selected ? (
            <Panel>
              <Empty icon={ShieldCheck} text="Pick a team member to manage their access." />
            </Panel>
          ) : (
            <>
              <Panel title={selected.full_name} right={<Pill tone="mist">{selected.role}</Pill>}>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    value={selected.role}
                    onChange={(e) =>
                      roleMutation.mutate({ id: selected.id, nextRole: e.target.value })
                    }
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      activeMutation.mutate({ id: selected.id, active: !selected.active })
                    }
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
                      selected.active
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/12 text-primary",
                    )}
                  >
                    {selected.active ? (
                      <>
                        <UserX className="size-3.5" /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-3.5" /> Activate
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void sendOtp(selected)}
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                  >
                    <KeyRound className="size-3.5" /> Send one-time password
                  </button>
                </div>
              </Panel>

              <Panel
                title="Page permissions"
                right={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllMutation.mutate({ member: selected, allowed: true })}
                      className="rounded-lg bg-primary/12 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      Allow all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllMutation.mutate({ member: selected, allowed: false })}
                      className="rounded-lg bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
                    >
                      Block all
                    </button>
                  </div>
                }
              >
                <div className="space-y-4">
                  {PAGE_CATALOG.map((group) => (
                    <div key={group.group}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        {group.group}
                      </p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {group.pages.map((page) => {
                          const allowed = isAllowed(selected, page.key);
                          return (
                            <button
                              key={page.key}
                              type="button"
                              onClick={() =>
                                togglePageMutation.mutate({
                                  member: selected,
                                  pageKey: page.key,
                                  allowed: !allowed,
                                })
                              }
                              className={cn(
                                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                                allowed
                                  ? "border-primary/30 bg-primary/5 text-foreground"
                                  : "border-border bg-muted/40 text-muted-foreground",
                              )}
                            >
                              <span className="truncate">{page.label}</span>
                              <span
                                className={cn(
                                  "ml-2 size-2 shrink-0 rounded-full",
                                  allowed ? "bg-primary" : "bg-muted-foreground/40",
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Pages with no override stay allowed. Blocked pages are hidden from the user's
                  navigation and guarded on load.
                </p>
              </Panel>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
