import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SearchInput, matches } from "@/components/search";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
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

export const Route = createFileRoute("/_authenticated/apps")({
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
  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () =>
      (await supabase.from("payment_reminders").select("*").order("sent_at", { ascending: false })).data ?? [],
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
    () => rows.filter((r) => matches(q, r.business_name, r.app_url, r.app_status, r.industry as string | null)),
    [rows, q],
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

  return (
    <AppShell
      title="App status"
      subtitle={`Reminders every 2 days while overdue. Shutdown only allowed after ${GRACE_DAYS} days.`}
      actions={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search apps…" />
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live apps" value={String(rows.filter((r) => r.app_status === "Live").length)} tone="leaf" />
        <Stat label="In grace period" value={String(inGrace.length)} hint="Overdue, still running" tone="mist" />
        <Stat label="Eligible for shutdown" value={String(atRisk.length)} hint={`>${GRACE_DAYS} days past due`} tone="deep" />
        <Stat label="Revenue paused" value={money(lostRevenue)} hint="MRR of switched-off apps" tone="leaf" />
      </div>

      <Panel title="Closed for unpaid invoices" right={<Pill tone="warn">{suspended.length}</Pill>}>
        {suspended.length === 0 ? (
          <Empty>No app has been switched off.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH>App</TH>
                <TH>Closed on</TH>
                <TH>Reason</TH>
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
                <TD className="text-muted-foreground">{r.app_url ?? "—"}</TD>
                <TD>{fmtDate(r.suspended_at)}</TD>
                <TD className="text-muted-foreground">{r.suspension_reason ?? "—"}</TD>
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
                <TH>Paid through</TH>
                <TH>Days overdue</TH>
                <TH>Reminders</TH>
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
                <TD>{fmtDate(r.through)}</TD>
                <TD>
                  <Pill tone={r.suspendable ? "warn" : "mist"}>{r.daysOverdue} d</Pill>
                </TD>
                <TD className="text-muted-foreground">
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
                <TH>Due date</TH>
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
                <TD>{fmtDate(r.due_date)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
