import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  PowerOff,
  Send,
  Building2,
  Sparkles,
  Server,
  Mail,
  History,
  LayoutGrid,
  Table as TableIcon,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SearchInput, matches } from "@/components/search";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BuildPipelineSection } from "@/components/BuildPipelineSection";
import { fetchMergedClients, fetchMergedProjects } from "@/lib/pipeline-store";
import { fetchMergedProspects } from "@/lib/prospects-store";
import { fetchMergedAccounts } from "@/lib/lovable-accounts-store";
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
      { title: "App status & Workflows — Agency Hub" },
      {
        name: "description",
        content:
          "Client application health, active build pipeline workflows, and automated grace period monitoring.",
      },
      { property: "og:title", content: "App status & Workflows — Agency Hub" },
      {
        property: "og:description",
        content:
          "Live client web applications, development pipeline stages, and billing governance.",
      },
    ],
  }),
  component: Apps,
});

type Channel = (typeof REMINDER_CHANNELS)[number]["value"];
type ViewMode = "all" | "pipeline" | "live-apps" | "grace";

export function Apps() {
  const qc = useQueryClient();
  const { role, memberId } = useAuth();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [q, setQ] = useState("");
  const [appStatus, setAppStatus] = useState("all");
  const [billing, setBilling] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [appsDisplayMode, setAppsDisplayMode] = useState<"table" | "cards">("table");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
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
    queryFn: fetchMergedAccounts,
  });
  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () =>
      (await supabase.from("payment_reminders").select("*").order("sent_at", { ascending: false }))
        .data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchMergedProjects,
  });
  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: fetchMergedProspects,
  });

  const rows = useMemo(() => {
    return clients
      .map((c) => {
        const through = paidThrough(payments.filter((p) => p.client_id === c.id));
        const last = reminders.find((r) => r.client_id === c.id)?.sent_at ?? null;
        const state = dueState(through ?? c.signed_date, last);
        const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
        const sent = reminders.filter((r) => r.client_id === c.id).length;
        const assignedAccount = accounts.find((a) => a.id === c.hosting_account_id);

        return {
          ...c,
          ...state,
          rate,
          lastReminder: last,
          remindersSent: sent,
          accountEmail: assignedAccount?.email || null,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [clients, payments, subs, reminders, accounts]);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (appStatus === "all" || r.app_status === appStatus) &&
          (billing === "all" ||
            (billing === "overdue"
              ? r.overdue
              : billing === "grace"
                ? r.overdue && !r.suspendable
                : billing === "past-grace"
                  ? r.suspendable
                  : !r.overdue)) &&
          matches(
            q,
            r.business_name,
            r.app_url,
            r.app_status,
            r.industry as string | null,
            r.accountEmail,
          ),
      ),
    [rows, q, appStatus, billing],
  );

  const liveApps = visible.filter((r) => r.app_status === "Live" && !r.overdue);
  const inGrace = visible.filter((r) => r.overdue && r.app_status === "Live");
  const atRisk = inGrace.filter((r) => r.suspendable);
  const suspended = visible.filter(
    (r) => r.app_status === "Suspended" || r.app_status === "Closed",
  );
  const lostRevenue = suspended.reduce((s, r) => s + r.rate, 0);
  const atRiskRevenue = inGrace.reduce((s, r) => s + r.rate, 0);

  const copyAppUrl = (url: string | null) => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    toast.success("App URL copied to clipboard");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const remind = useMutation({
    mutationFn: async (row: (typeof rows)[number]) => {
      const channelLabel = REMINDER_CHANNELS.find((c) => c.value === channel)?.label ?? channel;
      const { error } = await supabase.from("payment_reminders").insert({
        client_id: row.id,
        due_date: row.through ?? todayISO(),
        channel,
        message: `Payment of ${money(row.rate)} is ${row.daysOverdue} day(s) overdue. Your app will be switched off ${GRACE_DAYS} days after the due date.`,
        sent_by: memberId,
      });
      if (error) throw error;
      return { clientName: row.business_name, channelLabel };
    },
    onSuccess: (data) => {
      toast.success(`Reminder queued via ${data.channelLabel} for ${data.clientName}`);
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (v: {
      id: string;
      status: "Live" | "Suspended" | "Closed";
      days: number;
    }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          app_status: v.status,
          suspended_at: v.status === "Live" ? null : todayISO(),
          suspension_reason:
            v.status === "Live"
              ? null
              : `Unpaid invoice — ${v.days} days past due (grace ${GRACE_DAYS} days)`,
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

  return (
    <AppShell
      title="App status & Workflows"
      subtitle="Complete operational control of client web applications, build pipelines, and automated grace periods."
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search apps, clients, domains…" />

          {/* App Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground">App:</span>
            <select
              value={appStatus}
              onChange={(e) => setAppStatus(e.target.value)}
              className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="Live">Live</option>
              <option value="Suspended">Suspended</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Billing State Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground">Billing:</span>
            <select
              value={billing}
              onChange={(e) => setBilling(e.target.value)}
              className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="all">All billing</option>
              <option value="current">Current</option>
              <option value="grace">In grace ({inGrace.length})</option>
              <option value="past-grace">Past grace ({atRisk.length})</option>
              <option value="overdue">Any overdue</option>
            </select>
          </div>

          {/* Channel Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs">
            <Send className="size-3 text-primary" />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
            >
              {REMINDER_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  Via {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Live client apps"
          value={String(rows.filter((r) => r.app_status === "Live").length)}
          hint={`${liveApps.length} paid current · ${inGrace.length} in grace`}
          tone="leaf"
        />
        <Stat
          label="In grace period"
          value={String(inGrace.length)}
          hint={`${money(atRiskRevenue)} MRR in grace`}
          tone="mist"
        />
        <Stat
          label="Eligible for shutdown"
          value={String(atRisk.length)}
          hint={`>${GRACE_DAYS} days overdue`}
          tone="deep"
        />
        <Stat
          label="Revenue paused"
          value={money(lostRevenue)}
          hint={`${suspended.length} switched off app(s)`}
          tone="warn"
        />
      </div>

      {/* View Mode Segmented Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "all"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>Overview & All</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pipeline")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "pipeline"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5 text-primary" />
            <span>Build Pipeline & Workflows</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
              {projects.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("live-apps")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "live-apps"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Production Apps Directory</span>
            <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-bold text-foreground">
              {visible.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grace")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "grace"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span>Grace & Suspensions</span>
            {inGrace.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                {inGrace.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            Grace window: <strong className="text-foreground">{GRACE_DAYS} days</strong>
          </span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">Reminders sent every 48h</span>
        </div>
      </div>

      {/* SECTION 1: PRODUCTION APPS DIRECTORY */}
      {(viewMode === "all" || viewMode === "live-apps") && (
        <Panel
          title={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Globe className="size-4" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-base font-semibold text-foreground tracking-tight">
                  Production Web Applications
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {visible.length} active clients
                </span>
              </div>
            </div>
          }
          right={
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Showing {visible.length} of {rows.length} apps
              </span>
              <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setAppsDisplayMode("table")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    appsDisplayMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="size-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppsDisplayMode("cards")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    appsDisplayMode === "cards"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="size-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          }
        >
          {visible.length === 0 ? (
            <Empty>No client applications match the filter criteria.</Empty>
          ) : appsDisplayMode === "table" ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table
                head={
                  <>
                    <TH>Client & Application</TH>
                    <TH>Live Deployment URL</TH>
                    <TH>Health & Lifecycle Status</TH>
                    <TH className="hidden sm:table-cell">Hosting Email</TH>
                    <TH>Monthly MRR</TH>
                    <TH className="hidden md:table-cell">Paid Through</TH>
                    <TH className="text-right">Actions</TH>
                  </>
                }
              >
                {visible.map((r) => {
                  const isSuspended = r.app_status === "Suspended" || r.app_status === "Closed";
                  const isHealthy = r.app_status === "Live" && !r.overdue;

                  return (
                    <tr key={r.id} className="transition hover:bg-secondary/30">
                      {/* Client Name & Industry */}
                      <TD className="font-medium">
                        <div className="flex items-start gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 font-bold text-foreground">
                            {r.business_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              to="/clients/$id"
                              params={{ id: r.id }}
                              className="font-semibold text-foreground transition hover:text-primary hover:underline"
                            >
                              {r.business_name}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {r.industry && <span>{r.industry}</span>}
                              {r.contact_name && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{r.contact_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TD>

                      {/* Live Deployment URL */}
                      <TD>
                        {r.app_url ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={r.app_url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[170px] truncate font-mono text-xs text-foreground transition hover:text-primary hover:underline sm:max-w-[220px]"
                              title={r.app_url}
                            >
                              {r.app_url.replace(/^https?:\/\//, "")}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyAppUrl(r.app_url)}
                              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                              title="Copy URL"
                            >
                              {copiedUrl === r.app_url ? (
                                <Check className="size-3 text-primary" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                            <a
                              href={r.app_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded p-1 text-primary hover:bg-secondary transition"
                              title="Open live site in new tab"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No production URL
                          </span>
                        )}
                      </TD>

                      {/* Status */}
                      <TD>
                        {isHealthy ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live & Healthy
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                            <PowerOff className="size-3" />
                            Switched Off ({r.app_status})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="size-3" />
                            In Grace ({r.daysOverdue}d overdue)
                          </span>
                        )}
                      </TD>

                      {/* Hosting Email */}
                      <TD className="hidden sm:table-cell">
                        <span
                          className="truncate max-w-[130px] text-xs text-muted-foreground font-mono"
                          title={r.accountEmail || "Unassigned"}
                        >
                          {r.accountEmail || "—"}
                        </span>
                      </TD>

                      {/* Monthly MRR */}
                      <TD className="font-semibold text-foreground font-mono">{money(r.rate)}</TD>

                      {/* Paid Through */}
                      <TD className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                        {fmtDate(r.through)}
                      </TD>

                      {/* Actions */}
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.overdue && r.app_status === "Live" && (
                            <button
                              type="button"
                              onClick={() => remind.mutate(r)}
                              disabled={!r.reminderDue || remind.isPending}
                              title={
                                r.reminderDue
                                  ? `Send reminder via ${channel}`
                                  : "Reminder sent within the last 48 hours"
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40"
                            >
                              <Send className="size-3 text-primary" />
                              <span>Remind</span>
                            </button>
                          )}

                          {isSuspended && role === "admin" && (
                            <button
                              type="button"
                              onClick={() =>
                                setStatus.mutate({ id: r.id, status: "Live", days: r.daysOverdue })
                              }
                              disabled={setStatus.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
                            >
                              <RotateCcw className="size-3" />
                              <span>Restore</span>
                            </button>
                          )}

                          {r.suspendable && r.app_status === "Live" && role === "admin" && (
                            <button
                              type="button"
                              onClick={() =>
                                setStatus.mutate({
                                  id: r.id,
                                  status: "Suspended",
                                  days: r.daysOverdue,
                                })
                              }
                              disabled={setStatus.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground shadow-xs transition hover:opacity-90"
                            >
                              <PowerOff className="size-3" />
                              <span>Switch off</span>
                            </button>
                          )}

                          <Link
                            to="/clients/$id"
                            params={{ id: r.id }}
                            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            title="Open client detail & credentials"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </Table>
            </div>
          ) : (
            /* CARD VIEW FOR PRODUCTION WEB APPLICATIONS */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((r) => {
                const isSuspended = r.app_status === "Suspended" || r.app_status === "Closed";
                const isHealthy = r.app_status === "Live" && !r.overdue;

                return (
                  <div
                    key={r.id}
                    className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="space-y-3.5">
                      {/* Top Row: Avatar, Name, Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-xs font-bold text-foreground shadow-xs">
                            {r.business_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/clients/$id"
                              params={{ id: r.id }}
                              className="block truncate font-semibold text-foreground transition hover:text-primary hover:underline"
                              title={r.business_name}
                            >
                              {r.business_name}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              {r.industry && <span className="truncate">{r.industry}</span>}
                              {r.contact_name && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{r.contact_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isHealthy ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live
                            </span>
                          ) : isSuspended ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                              <PowerOff className="size-2.5" />
                              Off
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="size-2.5" />
                              Grace ({r.daysOverdue}d)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live Deployment URL Bar */}
                      <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            {r.app_url ? (
                              <a
                                href={r.app_url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-mono text-xs font-medium text-foreground transition hover:text-primary hover:underline"
                                title={r.app_url}
                              >
                                {r.app_url.replace(/^https?:\/\//, "")}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No production URL
                              </span>
                            )}
                          </div>

                          {r.app_url && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => copyAppUrl(r.app_url)}
                                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                                title="Copy URL"
                              >
                                {copiedUrl === r.app_url ? (
                                  <Check className="size-3 text-primary" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                              <a
                                href={r.app_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1 text-primary hover:bg-secondary transition"
                                title="Open live site"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                            Monthly MRR
                          </span>
                          <span className="mt-0.5 block font-mono font-bold text-foreground">
                            {money(r.rate)}
                            <span className="text-[10px] font-normal text-muted-foreground">
                              /mo
                            </span>
                          </span>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                            Paid Through
                          </span>
                          <span className="mt-0.5 block font-mono text-xs font-semibold text-foreground">
                            {fmtDate(r.through)}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Hosting Account */}
                      {r.accountEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="size-3 shrink-0 text-muted-foreground/70" />
                          <span className="truncate font-mono text-[11px]">{r.accountEmail}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <Link
                        to="/clients/$id"
                        params={{ id: r.id }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>Manage Client</span>
                        <ExternalLink className="size-3" />
                      </Link>

                      <div className="flex items-center gap-1.5">
                        {r.overdue && r.app_status === "Live" && (
                          <button
                            type="button"
                            onClick={() => remind.mutate(r)}
                            disabled={!r.reminderDue || remind.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40"
                          >
                            <Send className="size-3 text-primary" />
                            <span>Remind</span>
                          </button>
                        )}

                        {isSuspended && role === "admin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setStatus.mutate({ id: r.id, status: "Live", days: r.daysOverdue })
                            }
                            disabled={setStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
                          >
                            <RotateCcw className="size-3" />
                            <span>Restore</span>
                          </button>
                        )}

                        {r.suspendable && r.app_status === "Live" && role === "admin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setStatus.mutate({
                                id: r.id,
                                status: "Suspended",
                                days: r.daysOverdue,
                              })
                            }
                            disabled={setStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground shadow-xs transition hover:opacity-90"
                          >
                            <PowerOff className="size-3" />
                            <span>Switch off</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* SECTION 2: WORKFLOWS & BUILD PIPELINE */}
      {(viewMode === "all" || viewMode === "pipeline") && (
        <BuildPipelineSection
          projects={projects}
          clients={clients}
          accounts={accounts}
          prospects={prospects}
          currentMemberId={memberId}
        />
      )}

      {/* SECTION 3: GRACE PERIOD & SUSPENSIONS GOVERNANCE */}
      {(viewMode === "all" || viewMode === "grace") && (
        <div className="space-y-6">
          {/* Overdue in Grace Table */}
          <Panel
            title={
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs">
                  <ShieldAlert className="size-4" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-semibold text-foreground tracking-tight">
                    Overdue Apps in Grace Period
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {inGrace.length} active apps
                  </span>
                </div>
              </div>
            }
            right={
              <span className="text-xs text-muted-foreground">
                Grace threshold: {GRACE_DAYS} days overdue
              </span>
            }
          >
            {inGrace.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-8 text-center">
                <CheckCircle2 className="mx-auto size-8 text-primary opacity-60" />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  All Client Accounts Current
                </p>
                <p className="text-xs text-muted-foreground">
                  No applications are currently in grace period or pending suspension.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table
                  head={
                    <>
                      <TH>Client Name</TH>
                      <TH className="hidden sm:table-cell">Paid Through</TH>
                      <TH>Days Overdue</TH>
                      <TH className="hidden md:table-cell">Reminders Sent</TH>
                      <TH>Monthly Rate</TH>
                      <TH className="text-right">Action</TH>
                    </>
                  }
                >
                  {inGrace.map((r) => (
                    <tr key={r.id} className="transition hover:bg-secondary/30">
                      <TD className="font-medium">
                        <Link
                          to="/clients/$id"
                          params={{ id: r.id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {r.business_name}
                        </Link>
                      </TD>
                      <TD className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtDate(r.through)}
                      </TD>
                      <TD>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.suspendable
                              ? "bg-destructive/15 text-destructive"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          <AlertTriangle className="size-3" />
                          {r.daysOverdue} days
                          {r.suspendable
                            ? " (past grace)"
                            : ` (${GRACE_DAYS - r.daysOverdue}d left)`}
                        </span>
                      </TD>
                      <TD className="hidden text-xs text-muted-foreground md:table-cell">
                        {r.remindersSent} sent
                        {r.lastReminder ? ` · last ${fmtDate(r.lastReminder)}` : ""}
                      </TD>
                      <TD className="font-semibold text-foreground">{money(r.rate)}</TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => remind.mutate(r)}
                            disabled={!r.reminderDue || remind.isPending}
                            title={
                              r.reminderDue
                                ? `Send reminder via ${channel}`
                                : "A reminder was sent in the last 48 hours"
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40"
                          >
                            <Send className="size-3 text-primary" />
                            <span>Send reminder</span>
                          </button>
                          {role === "admin" && (
                            <button
                              type="button"
                              onClick={() =>
                                setStatus.mutate({
                                  id: r.id,
                                  status: "Suspended",
                                  days: r.daysOverdue,
                                })
                              }
                              disabled={!r.suspendable || setStatus.isPending}
                              title={
                                r.suspendable
                                  ? "Switch off application due to unpaid invoices past grace"
                                  : `Shutdown permitted only after ${GRACE_DAYS} days overdue`
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-40"
                            >
                              <PowerOff className="size-3" />
                              <span>Switch off</span>
                            </button>
                          )}
                        </div>
                      </TD>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Panel>

          {/* Suspended Apps Table */}
          <Panel
            title={
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive shadow-xs">
                  <PowerOff className="size-4" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-semibold text-foreground tracking-tight">
                    Switched Off Applications
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                    {suspended.length} offline
                  </span>
                </div>
              </div>
            }
            right={
              <span className="text-xs font-semibold text-destructive">
                Total MRR paused: {money(lostRevenue)}
              </span>
            }
          >
            {suspended.length === 0 ? (
              <Empty>No client applications are currently switched off.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table
                  head={
                    <>
                      <TH>Client Organization</TH>
                      <TH className="hidden md:table-cell">Production Domain</TH>
                      <TH className="hidden sm:table-cell">Suspended On</TH>
                      <TH className="hidden lg:table-cell">Suspension Reason</TH>
                      <TH>Recoverable MRR</TH>
                      <TH className="text-right">Action</TH>
                    </>
                  }
                >
                  {suspended.map((r) => (
                    <tr key={r.id} className="transition hover:bg-secondary/30">
                      <TD className="font-medium">
                        <Link
                          to="/clients/$id"
                          params={{ id: r.id }}
                          className="font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {r.business_name}
                        </Link>
                      </TD>
                      <TD className="hidden text-xs font-mono text-muted-foreground md:table-cell">
                        {r.app_url ?? "—"}
                      </TD>
                      <TD className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtDate(r.suspended_at)}
                      </TD>
                      <TD className="hidden text-xs text-muted-foreground lg:table-cell">
                        {r.suspension_reason ?? "Unpaid invoices past grace"}
                      </TD>
                      <TD className="font-semibold text-primary">{money(r.rate)}</TD>
                      <TD className="text-right">
                        {role === "admin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setStatus.mutate({ id: r.id, status: "Live", days: r.daysOverdue })
                            }
                            disabled={setStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
                          >
                            <RotateCcw className="size-3" />
                            <span>Restore App</span>
                          </button>
                        )}
                      </TD>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Panel>

          {/* Reminder Log */}
          <Panel
            title={
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-xs">
                  <History className="size-4" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-semibold text-foreground tracking-tight">
                    Automated Reminder Dispatch Log
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                    {reminders.length} dispatched
                  </span>
                </div>
              </div>
            }
          >
            {reminders.length === 0 ? (
              <Empty>No payment reminders have been dispatched yet.</Empty>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table
                  head={
                    <>
                      <TH>Sent Timestamp</TH>
                      <TH>Client Account</TH>
                      <TH>Delivery Channel</TH>
                      <TH className="hidden sm:table-cell">Invoice Due Date</TH>
                      <TH className="hidden md:table-cell">Notification Message</TH>
                    </>
                  }
                >
                  {reminders.slice(0, 30).map((r) => (
                    <tr key={r.id} className="transition hover:bg-secondary/30">
                      <TD className="text-xs text-muted-foreground">{fmtDate(r.sent_at)}</TD>
                      <TD className="font-medium text-foreground">
                        {clients.find((c) => c.id === r.client_id)?.business_name ?? "Client"}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                          {REMINDER_CHANNELS.find((c) => c.value === r.channel)?.label ?? r.channel}
                        </span>
                      </TD>
                      <TD className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtDate(r.due_date)}
                      </TD>
                      <TD className="hidden max-w-xs truncate text-xs text-muted-foreground md:table-cell">
                        {r.message}
                      </TD>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
