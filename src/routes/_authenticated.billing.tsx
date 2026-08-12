import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, fmtDate, money, paidThrough, todayISO } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Agency OS" },
      { name: "description", content: "Record multi-month payments and see who is overdue at a glance." },
      { property: "og:title", content: "Billing — Agency OS" },
      { property: "og:description", content: "Multi-month payment entry with automatic paid-through math." },
    ],
  }),
  component: Billing,
});

function Billing() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ client_id: "", amount: "", months: "1", payment_date: todayISO(), method: "Transfer" });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, business_name, status")).data ?? [],
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

  const standing = useMemo(() => {
    const now = todayISO();
    return clients.map((c) => {
      const through = paidThrough(payments.filter((p) => p.client_id === c.id));
      const rate = subs.find((s) => s.client_id === c.id)?.monthly_rate ?? null;
      return { ...c, through, rate, overdue: !through || through < now };
    });
  }, [clients, payments, subs]);

  const overdue = standing.filter((s) => s.overdue && s.status === "Active");

  return (
    <AppShell title="Billing" subtitle="Multi-month payments, paid-through math handled for you.">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel title="Record payment">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount"
              inputMode="decimal"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.months}
              onChange={(e) => setForm({ ...form, months: e.target.value })}
              placeholder="Months covered"
              inputMode="numeric"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
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
              {["Transfer", "Card", "Cash", "Other"].map((m) => (
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

        <Panel title="Needs attention" right={<Pill tone="warn">{overdue.length} overdue</Pill>}>
          {overdue.length === 0 ? (
            <Empty>Everyone is current.</Empty>
          ) : (
            <div className="space-y-2">
              {overdue.map((c) => (
                <div key={c.id} className="gradient-mist flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm font-medium">{c.business_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.through ? `through ${fmtDate(c.through)}` : "never paid"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Payment history">
        {payments.length === 0 ? (
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
            {payments.map((p) => (
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
