import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import {
  Combobox,
  DateRangeFilter,
  EMPTY_RANGE,
  FilterSelect,
  SearchInput,
  inRange,
  matches,
  type DateRange,
} from "@/components/search";
import { buildStanding, summarise, type ClientRow } from "@/lib/standing";
import { supabase } from "@/integrations/supabase/client";
import { MONTH_OPTIONS, PAYMENT_METHODS, addMonths, fmtDate, money, paidThrough, todayISO } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Lovable Solutions" },
      { name: "description", content: "Record multi-month payments and see who is overdue at a glance." },
      { property: "og:title", content: "Billing — Lovable Solutions" },
      { property: "og:description", content: "Multi-month payment entry with automatic paid-through math." },
    ],
  }),
  component: Billing,
});

function Billing() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ client_id: "", amount: "", months: "1", payment_date: todayISO(), method: "MOMO" });

  const [q, setQ] = useState("");
  const [method, setMethod] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*").order("payment_date", { ascending: false })).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });

  const record = useMutation({
    mutationFn: async () => {
      const months = Number(form.months) || 1;
      const prior = paidThrough(payments.filter((p) => p.client_id === form.client_id));
      const start: string = prior ?? form.payment_date;
      const { error } = await supabase.from("payments").insert({
        client_id: form.client_id,
        amount: Number(form.amount),
        months_covered: months,
        payment_date: form.payment_date,
        method: form.method,
        covers_period_start: start,
        covers_period_end: addMonths(start, months),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setForm({ ...form, client_id: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });




  const summary = useMemo(
    () =>
      summarise(
        buildStanding(
          clients as unknown as ClientRow[],
          payments as { client_id: string; covers_period_end: string; amount: number }[],
          subs as { client_id: string; monthly_rate: number; status: string }[],
        ),
      ),
    [clients, payments, subs],
  );

  const attention = summary.overdue;

  const visiblePayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          (method === "all" || p.method === method) &&
          (clientFilter === "all" || p.client_id === clientFilter) &&
          inRange(p.payment_date, range) &&
          matches(q, clients.find((c) => c.id === p.client_id)?.business_name, p.method, String(p.amount)),
      ),
    [payments, clients, q, method, clientFilter, range],
  );

  return (
    <AppShell title="Billing" subtitle="Multi-month payments, paid-through math handled for you.">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Expected revenue" value={money(summary.expectedRevenue)} hint="Owed by apps past the grace window" tone="deep" />
        <Stat label="Total owed" value={money(summary.totalOwed)} hint={`${summary.overdue.length} overdue clients`} tone="mist" />
        <Stat label="Collected all-time" value={money(summary.collected)} tone="leaf" />
        <Stat label="Active MRR" value={money(summary.mrr)} hint={`${summary.activeCount} active clients`} tone="mist" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel title="Record payment">
          <div className="grid gap-3 md:grid-cols-2">
            <Combobox
              className="md:col-span-2"
              value={form.client_id}
              onChange={(v) => setForm({ ...form, client_id: v })}
              placeholder="Search and select client…"
              options={clients.map((c) => ({ value: c.id, label: c.business_name, hint: c.status }))}
            />
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount (RWF)"
              inputMode="decimal"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={form.months}
              onChange={(e) => setForm({ ...form, months: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={String(m)}>
                  {m} month{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => record.mutate()}
            disabled={!form.client_id || !form.amount}
            className="gradient-leaf mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Record payment
          </button>
        </Panel>

        <Panel title="Needs attention" right={<Pill tone="warn">{attention.length} overdue</Pill>}>
          {attention.length === 0 ? (
            <Empty>Everyone is current.</Empty>
          ) : (
            <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {attention.map((c) => (
                <div key={c.id} className="gradient-mist rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/clients/$id"
                        params={{ id: c.id }}
                        className="truncate text-sm font-semibold text-primary hover:underline"
                      >
                        {c.business_name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.through ? `paid through ${fmtDate(c.through)}` : "never paid"}
                        {c.owed > 0 ? ` · owes ${money(c.owed)}` : ""}
                      </p>
                    </div>
                    <Pill tone={c.pastGrace ? "warn" : "mist"}>
                      {c.daysOverdue > 0 ? `${c.daysOverdue}d overdue` : "due"}
                    </Pill>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, client_id: c.id, amount: c.rate ? String(c.rate) : f.amount }))}
                      className="text-primary hover:underline"
                    >
                      Log payment
                    </button>
                    <Link to="/clients/$id" params={{ id: c.id }} className="text-primary hover:underline">
                      Open profile
                    </Link>
                    <Link to="/apps" className="text-primary hover:underline">
                      App status
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Payment history"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Method" value={method} onChange={setMethod} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
            <FilterSelect
              label="Client"
              value={clientFilter}
              onChange={setClientFilter}
              options={clients.map((c) => ({ value: c.id, label: c.business_name }))}
            />
            <DateRangeFilter label="Paid on" value={range} onChange={setRange} />
            <SearchInput value={q} onChange={setQ} placeholder="Search payments…" />
          </div>
        }
      >

        {visiblePayments.length === 0 ? (
          <Empty>No payments yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH>Paid on</TH>
                <TH>Amount</TH>
                <TH>Months</TH>
                <TH>Covers</TH>
                <TH>Method</TH>
              </>
            }
          >
            {visiblePayments.map((p) => (
              <tr key={p.id}>
                <TD className="font-medium">{clients.find((c) => c.id === p.client_id)?.business_name ?? "—"}</TD>
                <TD>{fmtDate(p.payment_date)}</TD>
                <TD className="font-medium text-primary">{money(p.amount)}</TD>
                <TD>{p.months_covered}</TD>
                <TD>
                  {fmtDate(p.covers_period_start)} → {fmtDate(p.covers_period_end)}
                </TD>
                <TD>{p.method}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
