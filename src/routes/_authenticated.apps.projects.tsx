import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { Empty, Panel, Pill, Stat } from "@/components/dash";
import { FilterSelect, SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/agency";

export const BUILD_STAGES = ["Planning", "Building", "Testing", "Shipped"] as const;
export const PAYMENT_STATES = ["Unpaid", "Deposit", "Awaiting payment", "Paid"] as const;

export const Route = createFileRoute("/_authenticated/apps/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Lovable Solutions" },
      { name: "description", content: "Pick a project and see the client, the hosting email account and the build stage." },
      { property: "og:title", content: "Projects — Lovable Solutions" },
      { property: "og:description", content: "Every build, its owner, its account and its payment state." },
    ],
  }),
  component: Projects,
});

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Projects() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [picked, setPicked] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await supabase.from("projects").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => (await supabase.from("prospects").select("id, business_name, stage").order("business_name")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: async () => (await supabase.from("lovable_accounts").select("*").order("email")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("id, full_name")).data ?? [],
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ["project-transfers"],
    queryFn: async () =>
      (await supabase.from("project_transfers").select("*").order("moved_at", { ascending: false })).data ?? [],
  });

  const clientOf = (id: string | null) => clients.find((c) => c.id === id);
  const accountOf = (id: string | null) => accounts.find((a) => a.id === id);

  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          (stage === "all" || p.build_stage === stage) &&
          matches(q, p.project_name, p.app_url, clientOf(p.client_id)?.business_name ?? null, p.payment_state),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, q, stage, clients],
  );

  const current = projects.find((p) => p.id === (picked ?? visible[0]?.id)) ?? null;
  const account = current ? accountOf(current.hosting_account_id) : undefined;
  const client = current ? clientOf(current.client_id) : undefined;
  const prospect = current ? prospects.find((x) => x.id === current.prospect_id) : undefined;

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!current) return;
      const { error } = await supabase.from("projects").update(patch).eq("id", current.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Project updated");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveAccount = useMutation({
    mutationFn: async (to: string) => {
      if (!current) return;
      const from = current.hosting_account_id ?? null;
      const upd = await supabase.from("projects").update({ hosting_account_id: to }).eq("id", current.id);
      if (upd.error) throw new Error(upd.error.message);
      if (current.client_id) {
        await supabase.from("clients").update({ hosting_account_id: to }).eq("id", current.client_id);
      }
      const log = await supabase.from("project_transfers").insert({
        client_id: current.client_id,
        from_account_id: from,
        to_account_id: to,
        note: `Moved from the Projects view (${current.project_name})`,
      });
      if (log.error) throw new Error(log.error.message);
    },
    onSuccess: () => {
      toast.success("Project moved to the new account");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["project-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const history = current ? transfers.filter((t) => t.client_id === current.client_id) : [];

  return (
    <AppShell
      title="App status"
      subtitle="Pick a project to see its client, its hosting account and where the build stands."
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search projects…" />
          <FilterSelect
            label="Stage"
            value={stage}
            onChange={setStage}
            options={BUILD_STAGES.map((s) => ({ value: s, label: s }))}
            allLabel="All stages"
          />
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Projects" value={String(projects.length)} tone="leaf" />
        <Stat label="In build" value={String(projects.filter((p) => p.build_stage !== "Shipped").length)} tone="mist" />
        <Stat label="Shipped" value={String(projects.filter((p) => p.build_stage === "Shipped").length)} tone="deep" />
        <Stat
          label="No account yet"
          value={String(projects.filter((p) => !p.hosting_account_id).length)}
          hint="Not hosted anywhere"
          tone="mist"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Projects" right={<Pill tone="mist">{visible.length}</Pill>}>
          {visible.length === 0 ? (
            <Empty>No project matches.</Empty>
          ) : (
            <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
              {visible.map((p) => {
                const active = current?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPicked(p.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      active ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{p.project_name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {clientOf(p.client_id)?.business_name ?? "No client"} · {p.build_stage}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Mail className="size-3 shrink-0" />
                      {accountOf(p.hosting_account_id)?.email ?? "no account"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        {current ? (
          <div className="space-y-4">
            <Panel
              title={current.project_name}
              right={<Pill tone={current.build_stage === "Shipped" ? "leaf" : "mist"}>{current.build_stage}</Pill>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hosted on</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="truncate">{account?.email ?? "Not assigned"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {account
                      ? `${Number(account.credits_remaining ?? 0).toLocaleString("en-US")} credits left${account.label ? ` · ${account.label}` : ""}`
                      : "Pick an account below"}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</p>
                  {client ? (
                    <Link to="/clients/$id" params={{ id: client.id }} className="mt-1 block truncate text-sm font-medium text-primary hover:underline">
                      {client.business_name}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm">—</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {prospect ? `From prospect · ${prospect.stage}` : "Direct client"}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeline</p>
                  <p className="mt-1 text-sm">
                    Started {fmtDate(current.started_at)} · Due {fmtDate(current.due_at)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {current.shipped_at ? `Shipped ${fmtDate(current.shipped_at)}` : "Not shipped yet"}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Built by</p>
                  <p className="mt-1 text-sm">{members.find((m) => m.id === current.built_by)?.full_name ?? "Unassigned"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{current.payment_state}</p>
                </div>
              </div>

              {current.app_url ? (
                <a
                  href={current.app_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  {current.app_url}
                </a>
              ) : null}
              {current.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{current.notes}</p> : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Build stage
                  <select
                    className={field + " mt-1"}
                    value={current.build_stage}
                    onChange={(e) =>
                      update.mutate({
                        build_stage: e.target.value,
                        shipped_at: e.target.value === "Shipped" ? (current.shipped_at ?? new Date().toISOString().slice(0, 10)) : null,
                      })
                    }
                  >
                    {BUILD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Payment
                  <select
                    className={field + " mt-1"}
                    value={current.payment_state}
                    onChange={(e) => update.mutate({ payment_state: e.target.value })}
                  >
                    {PAYMENT_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Hosting account
                  <select
                    className={field + " mt-1"}
                    value={current.hosting_account_id ?? ""}
                    disabled={!isAdmin}
                    onChange={(e) => e.target.value && moveAccount.mutate(e.target.value)}
                  >
                    <option value="">Pick an account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Panel>

            <Panel title="Linked platform accounts" right={<Pill tone="mist">Lovable · AI Studio · Manus · GitHub</Pill>}>
              <ProjectAccounts projectId={current.id} />
            </Panel>

            <Panel title="Account history" right={<Pill tone="mist">{history.length}</Pill>}>
              {history.length === 0 ? (
                <Empty>This project has never been moved.</Empty>
              ) : (
                <div className="space-y-2">
                  {history.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{accountOf(t.from_account_id)?.email ?? "—"}</span>
                      <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{accountOf(t.to_account_id)?.email ?? "—"}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDate(t.moved_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        ) : (
          <Panel title="Project">
            <Empty>Start a project from the Delivery tab to see it here.</Empty>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
