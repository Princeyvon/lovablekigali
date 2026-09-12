import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FilterSelect, SearchInput, matches } from "@/components/search";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  GRACE_DAYS,
  REMINDER_CHANNELS,
  dueState,
  fmtDate,
  money,
  paidThrough,
  todayISO,
} from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/apps/")({
  head: () => ({
    meta: [
      { title: "App status — Lovable Solutions" },
      { name: "description", content: "Which client web apps are live, in grace, or switched off for unpaid invoices." },
      { property: "og:title", content: "App status — Lovable Solutions" },
      { property: "og:description", content: "Two-week grace period, reminders every two days, then shutdown." },
    ],
  }),
  component: Apps,
});

type Channel = (typeof REMINDER_CHANNELS)[number]["value"];

function Apps() {
  const qc = useQueryClient();
  const { role, memberId } = useAuth();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [q, setQ] = useState("");
  const [appStatus, setAppStatus] = useState("all");
  const [billing, setBilling] = useState("all");
  const [newProject, setNewProject] = useState<{
    open: boolean;
    project_name: string;
    client_id: string;
    prospect_id: string;
    hosting_account_id: string;
    due_at: string;
    app_url: string;
  }>({ open: false, project_name: "", client_id: "", prospect_id: "", hosting_account_id: "", due_at: "", app_url: "" });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: async () => (await supabase.from("lovable_accounts").select("*").order("email")).data ?? [],
  });
  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () =>
      (await supabase.from("payment_reminders").select("*").order("sent_at", { ascending: false })).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await supabase.from("projects").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => (await supabase.from("prospects").select("id, business_name, client_id").order("business_name")).data ?? [],
  });

  const rows = useMemo(() => {
    return clients
      .map((c) => {
        const through = paidThrough(payments.filter((p) => p.client_id === c.id));
        const last = reminders.find((r) => r.client_id === c.id)?.sent_at ?? null;
        const state = dueState(through ?? c.signed_date, last);
        const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
        const sent = reminders.filter((r) => r.client_id === c.id).length;
        return { ...c, ...state, rate, lastReminder: last, remindersSent: sent };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [clients, payments, subs, reminders]);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (appStatus === "all" || r.app_status === appStatus) &&
          (billing === "all" ||
            (billing === "overdue" ? r.overdue : billing === "grace" ? r.overdue && !r.suspendable : billing === "past-grace" ? r.suspendable : !r.overdue)) &&
          matches(q, r.business_name, r.app_url, r.app_status, r.industry as string | null),
      ),
    [rows, q, appStatus, billing],
  );

  const suspended = visible.filter((r) => r.app_status === "Suspended" || r.app_status === "Closed");
  const inGrace = visible.filter((r) => r.overdue && r.app_status === "Live");
  const atRisk = inGrace.filter((r) => r.suspendable);
  const lostRevenue = suspended.reduce((s, r) => s + r.rate, 0);

  const remind = useMutation({
    mutationFn: async (row: (typeof rows)[number]) => {
      const { error } = await supabase.from("payment_reminders").insert({
        client_id: row.id,
        due_date: row.through ?? todayISO(),
        channel,
        message: `Payment of ${money(row.rate)} is ${row.daysOverdue} day(s) overdue. Your app will be switched off ${GRACE_DAYS} days after the due date.`,
        sent_by: memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder logged and queued");
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: "Live" | "Suspended" | "Closed"; days: number }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          app_status: v.status,
          suspended_at: v.status === "Live" ? null : todayISO(),
          suspension_reason:
            v.status === "Live" ? null : `Unpaid invoice — ${v.days} days past due (grace ${GRACE_DAYS} days)`,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("App status updated");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startProject = useMutation({
    mutationFn: async () => {
      const p = newProject;
      if (!p.project_name || !p.client_id) throw new Error("Name the project and pick a client");
      const { error } = await supabase.from("projects").insert({
        project_name: p.project_name,
        client_id: p.client_id,
        prospect_id: p.prospect_id || null,
        hosting_account_id: p.hosting_account_id || null,
        due_at: p.due_at || null,
        app_url: p.app_url || null,
        started_at: todayISO(),
        build_stage: "Planning",
        built_by: memberId,
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("clients")
        .update({
          project_name: p.project_name,
          build_stage: "Planning",
          build_started_at: todayISO(),
          built_by: memberId,
          ...(p.hosting_account_id ? { hosting_account_id: p.hosting_account_id } : {}),
        })
        .eq("id", p.client_id);
    },
    onSuccess: () => {
      setNewProject({ open: false, project_name: "", client_id: "", prospect_id: "", hosting_account_id: "", due_at: "", app_url: "" });
      toast.success("Project started");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async (v: { id: string; client_id: string | null; stage: "Planning" | "Building" | "Testing" | "Shipped" }) => {
      const shipped = v.stage === "Shipped" ? todayISO() : null;
      const { error } = await supabase
        .from("projects")
        .update({ build_stage: v.stage, shipped_at: shipped })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
      if (v.client_id) {
        await supabase.from("clients").update({ build_stage: v.stage, shipped_at: shipped }).eq("id", v.client_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const projectRows = useMemo(
    () =>
      projects
        .map((p) => {
          const c = clients.find((x) => x.id === p.client_id);
          const row = rows.find((r) => r.id === p.client_id);
          return {
            ...p,
            clientName: c?.business_name ?? "No client",
            account: accounts.find((a) => a.id === p.hosting_account_id)?.email ?? null,
            overdue: row?.overdue ?? false,
            daysOverdue: row?.daysOverdue ?? 0,
            through: row?.through ?? null,
          };
        })
        .filter((p) => matches(q, p.project_name, p.clientName, p.account, p.payment_state)),
    [projects, clients, rows, accounts, q],
  );

  return (
    <AppShell
      title="App status"
      subtitle={`Reminders every 2 days while overdue. Shutdown only allowed after ${GRACE_DAYS} days.`}
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search apps…" />
        <FilterSelect label="App" value={appStatus} onChange={setAppStatus} options={["Live","Suspended","Closed"].map((v)=>({value:v,label:v}))} />
        <FilterSelect
          label="Billing"
          value={billing}
          onChange={setBilling}
          options={[{value:"overdue",label:"Overdue"},{value:"grace",label:"In grace"},{value:"past-grace",label:"Past grace"},{value:"current",label:"Current"}]}
        />
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {REMINDER_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              Remind via {c.label}
            </option>
          ))}
        </select>
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live apps" value={String(rows.filter((r) => r.app_status === "Live").length)} tone="leaf" />
        <Stat label="In grace period" value={String(inGrace.length)} hint="Overdue, still running" tone="mist" />
        <Stat label="Eligible for shutdown" value={String(atRisk.length)} hint={`>${GRACE_DAYS} days past due`} tone="deep" />
        <Stat label="Revenue paused" value={money(lostRevenue)} hint="MRR of switched-off apps" tone="leaf" />
      </div>

      <Panel
        title="Build pipeline"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="mist">{projectRows.length}</Pill>
            <button
              onClick={() => setNewProject((s) => ({ ...s, open: !s.open }))}
              className="gradient-leaf rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              {newProject.open ? "Close" : "Start project"}
            </button>
          </div>
        }
      >
        {newProject.open ? (
          <div className="mb-4 grid gap-2 rounded-xl border border-border p-3 md:grid-cols-3">
            <input
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Project name"
              value={newProject.project_name}
              onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })}
            />
            <select
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={newProject.client_id}
              onChange={(e) => setNewProject({ ...newProject, client_id: e.target.value })}
            >
              <option value="">Client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={newProject.prospect_id}
              onChange={(e) => {
                const pr = prospects.find((x) => x.id === e.target.value);
                setNewProject({
                  ...newProject,
                  prospect_id: e.target.value,
                  client_id: pr?.client_id ?? newProject.client_id,
                });
              }}
            >
              <option value="">Prospect (optional)…</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.business_name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={newProject.hosting_account_id}
              onChange={(e) => setNewProject({ ...newProject, hosting_account_id: e.target.value })}
            >
              <option value="">Hosting account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={newProject.due_at}
              onChange={(e) => setNewProject({ ...newProject, due_at: e.target.value })}
            />
            <input
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="App URL (optional)"
              value={newProject.app_url}
              onChange={(e) => setNewProject({ ...newProject, app_url: e.target.value })}
            />
            <button
              onClick={() => startProject.mutate()}
              disabled={!newProject.project_name || !newProject.client_id}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-3"
            >
              Start project
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(["Planning", "Building", "Testing", "Shipped"] as const).map((stage) => {
            const list = projectRows.filter((p) => p.build_stage === stage);
            return (
              <div key={stage} className="rounded-2xl border border-border bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{stage}</p>
                  <Pill tone={stage === "Shipped" ? "leaf" : "mist"}>{list.length}</Pill>
                </div>
                <div className="mt-3 space-y-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing here.</p>
                  ) : (
                    list.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                        <Link to="/apps/projects" className="block truncate font-medium hover:underline">
                          {p.project_name}
                        </Link>
                        <span className="block truncate text-muted-foreground">
                          {p.clientName}
                          {p.account ? ` · ${p.account}` : " · no account"}
                        </span>
                        <span className="numeric block text-muted-foreground">
                          {p.overdue ? `${p.daysOverdue}d overdue` : p.through ? `next due ${fmtDate(p.through)}` : p.payment_state}
                        </span>
                        <select
                          value={p.build_stage}
                          onChange={(e) =>
                            moveStage.mutate({
                              id: p.id,
                              client_id: p.client_id,
                              stage: e.target.value as "Planning" | "Building" | "Testing" | "Shipped",
                            })
                          }
                          className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                        >
                          {(["Planning", "Building", "Testing", "Shipped"] as const).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>



      <Panel title="Closed for unpaid invoices" right={<Pill tone="warn">{suspended.length}</Pill>}>
        {suspended.length === 0 ? (
          <Empty>No app has been switched off.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH className="hidden md:table-cell">App</TH>
                <TH className="hidden sm:table-cell">Closed on</TH>
                <TH className="hidden lg:table-cell">Reason</TH>
                <TH>MRR lost</TH>
                <TH />
              </>
            }
          >
            {suspended.map((r) => (
              <tr key={r.id}>
                <TD className="font-medium">
                  <Link to="/clients/$id" params={{ id: r.id }} className="text-primary hover:underline">
                    {r.business_name}
                  </Link>
                </TD>
                <TD className="hidden text-muted-foreground md:table-cell">{r.app_url ?? "—"}</TD>
                <TD className="hidden sm:table-cell">{fmtDate(r.suspended_at)}</TD>
                <TD className="hidden text-muted-foreground lg:table-cell">{r.suspension_reason ?? "—"}</TD>
                <TD className="font-medium text-primary">{money(r.rate)}</TD>
                <TD>
                  {role === "admin" && (
                    <button
                      onClick={() => setStatus.mutate({ id: r.id, status: "Live", days: r.daysOverdue })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Restore
                    </button>
                  )}
                </TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Overdue and still running" right={<Pill tone="mist">{inGrace.length}</Pill>}>
        {inGrace.length === 0 ? (
          <Empty>Everyone is current.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH className="hidden sm:table-cell">Paid through</TH>
                <TH>Days overdue</TH>
                <TH className="hidden md:table-cell">Reminders</TH>
                <TH>Action</TH>
              </>
            }
          >
            {inGrace.map((r) => (
              <tr key={r.id}>
                <TD className="font-medium">
                  <Link to="/clients/$id" params={{ id: r.id }} className="text-primary hover:underline">
                    {r.business_name}
                  </Link>
                </TD>
                <TD className="hidden sm:table-cell">{fmtDate(r.through)}</TD>
                <TD>
                  <Pill tone={r.suspendable ? "warn" : "mist"}>{r.daysOverdue} d</Pill>
                </TD>
                <TD className="hidden text-muted-foreground md:table-cell">
                  {r.remindersSent} sent{r.lastReminder ? ` · last ${fmtDate(r.lastReminder)}` : ""}
                </TD>
                <TD>
                  <div className="flex gap-2">
                    <button
                      onClick={() => remind.mutate(r)}
                      disabled={!r.reminderDue}
                      title={r.reminderDue ? "" : "A reminder went out in the last 2 days"}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    >
                      Send reminder
                    </button>
                    {role === "admin" && (
                      <button
                        onClick={() => setStatus.mutate({ id: r.id, status: "Suspended", days: r.daysOverdue })}
                        disabled={!r.suspendable}
                        title={r.suspendable ? "" : `Only after ${GRACE_DAYS} days past due`}
                        className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-40"
                      >
                        Switch off
                      </button>
                    )}
                  </div>
                </TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Reminder log" right={<Pill tone="mist">{reminders.length}</Pill>}>
        {reminders.length === 0 ? (
          <Empty>No reminders sent yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Sent</TH>
                <TH>Client</TH>
                <TH>Channel</TH>
                <TH className="hidden sm:table-cell">Due date</TH>
              </>
            }
          >
            {reminders.slice(0, 40).map((r) => (
              <tr key={r.id}>
                <TD>{fmtDate(r.sent_at)}</TD>
                <TD className="font-medium">{clients.find((c) => c.id === r.client_id)?.business_name ?? "—"}</TD>
                <TD>
                  <Pill tone="leaf">{REMINDER_CHANNELS.find((c) => c.value === r.channel)?.label ?? r.channel}</Pill>
                </TD>
                <TD className="hidden sm:table-cell">{fmtDate(r.due_date)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
