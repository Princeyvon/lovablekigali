import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money, todayISO } from "@/lib/agency";

const CATEGORIES = ["Hosting", "Internet", "Transport", "Salaries", "Marketing", "Office", "Equipment", "General"];

export const Route = createFileRoute("/_authenticated/finance/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Lovable Solutions" },
      { name: "description", content: "Track operating costs in RWF by category and vendor." },
      { property: "og:title", content: "Expenses — Lovable Solutions" },
      { property: "og:description", content: "Every franc that leaves the agency." },
    ],
  }),
  component: Expenses,
});

const field = "rounded-xl border border-input bg-background px-3 py-2 text-sm";

function Expenses() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: todayISO(), category: "Hosting", amount: "", vendor: "", note: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        vendor: form.vendor || null,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setForm({ ...form, amount: "", vendor: "", note: "" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { total, thisMonth, byCategory } = useMemo(() => {
    const month = todayISO().slice(0, 7);
    const map = new Map<string, number>();
    let t = 0;
    let m = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      t += amt;
      if (e.date.startsWith(month)) m += amt;
      map.set(e.category, (map.get(e.category) ?? 0) + amt);
    }
    return { total: t, thisMonth: m, byCategory: [...map.entries()].sort((a, b) => b[1] - a[1]) };
  }, [expenses]);

  const max = Math.max(1, ...byCategory.map(([, v]) => v));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="All time" value={money(total)} tone="leaf" />
        <Stat label="This month" value={money(thisMonth)} tone="mist" />
        <Stat label="Entries" value={String(expenses.length)} tone="deep" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Add expense">
          <div className="grid gap-3 md:grid-cols-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (RWF)" inputMode="numeric" className={field} />
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor" className={field} />
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note" className={field + " md:col-span-2"} />
          </div>
          <button
            onClick={() => add.mutate()}
            disabled={!form.amount}
            className="gradient-leaf mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save expense
          </button>
        </Panel>

        <Panel title="By category">
          {byCategory.length === 0 ? (
            <Empty>Nothing spent yet.</Empty>
          ) : (
            <div className="space-y-3">
              {byCategory.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground">{money(val)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="gradient-bar h-full rounded-full" style={{ width: `${(val / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="History" right={<Pill tone="mist">{expenses.length}</Pill>}>
        {expenses.length === 0 ? (
          <Empty>No expenses yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Date</TH>
                <TH>Category</TH>
                <TH>Vendor</TH>
                <TH>Amount</TH>
                <TH>Note</TH>
              </>
            }
          >
            {expenses.map((e) => (
              <tr key={e.id}>
                <TD>{fmtDate(e.date)}</TD>
                <TD>
                  <Pill tone="mist">{e.category}</Pill>
                </TD>
                <TD className="font-medium">{e.vendor ?? "—"}</TD>
                <TD className="font-medium text-primary">{money(e.amount)}</TD>
                <TD className="text-muted-foreground">{e.note ?? "—"}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
