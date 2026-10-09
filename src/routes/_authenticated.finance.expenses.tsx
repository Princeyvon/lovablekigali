import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, Plus, Receipt, TrendingDown, Layers, Server, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { FINANCE_TABS } from "@/routes/_authenticated.finance";
import { Stat, Panel, Pill, Table, TH, TD, Empty } from "@/components/dash";
import { SearchInput, FilterSelect, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money, todayISO } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/finance/expenses")({
  head: () => ({
    meta: [
      { title: "Agency Expenses — Lovable Solutions" },
      {
        name: "description",
        content: "Internal software tools, hosting costs, and operations expenses.",
      },
    ],
  }),
  component: ExpensesPage,
});

const CATEGORIES = [
  "Software / AI Tools",
  "Hosting & Cloud",
  "Hardware & Office",
  "Marketing",
  "Legal & Accounting",
  "Other",
] as const;

function ExpensesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [isOpen, setIsOpen] = useState(false);

  const [form, setForm] = useState({
    vendor: "",
    category: "Software / AI Tools",
    amount: "100",
    date: todayISO(),
    note: "",
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () =>
      (await supabase.from("expenses").select("*").order("date", { ascending: false })).data ?? [],
  });

  const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const cloudTools = expenses.filter(
    (e) => e.category?.includes("Software") || e.category?.includes("Hosting"),
  );
  const cloudTotal = cloudTools.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchQ = matches(q, e.vendor, e.note, e.category);
      const matchCat = catFilter === "all" || e.category === catFilter;
      return matchQ && matchCat;
    });
  }, [expenses, q, catFilter]);

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!form.vendor.trim()) throw new Error("Vendor name is required");
      const { error } = await supabase.from("expenses").insert({
        vendor: form.vendor.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense logged");
      setIsOpen(false);
      setForm({
        vendor: "",
        category: "Software / AI Tools",
        amount: "100",
        date: todayISO(),
        note: "",
      });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Agency Expense Ledger"
      subtitle="Track tools, server infrastructure, builder subscriptions, and operational expenses."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search expenses…" />
          <FilterSelect
            label="Category"
            value={catFilter}
            onChange={setCatFilter}
            options={[
              { value: "all", label: "All Categories" },
              ...CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
          <button
            onClick={() => setIsOpen(true)}
            className="gradient-leaf flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-90"
          >
            <Plus className="size-4" /> Log Expense
          </button>
        </div>
      }
    >
      <SubTabs tabs={FINANCE_TABS} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Operating Costs"
          value={money(totalExpense)}
          hint={`${expenses.length} expense entries recorded`}
          tone="plain"
          icon={<Receipt className="size-4 text-rose-600 dark:text-rose-400" />}
        />
        <Stat
          label="AI & Cloud Tools"
          value={money(cloudTotal)}
          hint="Lovable, Google Cloud, Vercel"
          tone="mist"
          icon={<Server className="size-4 text-sky-600 dark:text-sky-400" />}
        />
        <Stat
          label="Recent Purchases"
          value={String(expenses.slice(0, 30).length)}
          hint="Last 30 transactions logged"
          tone="leaf"
          icon={<ShoppingBag className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Cost Categories"
          value={String(new Set(expenses.map((e) => e.category)).size || CATEGORIES.length)}
          hint="Active expense buckets"
          tone="deep"
          icon={<Layers className="size-4 text-purple-600 dark:text-purple-400" />}
        />
      </div>

      {/* Table */}
      <Panel title="Expense Records" right={<Pill tone="mist">{filtered.length} entries</Pill>}>
        {filtered.length === 0 ? (
          <Empty>No expenses recorded yet matching this filter.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <TH>Vendor / Service</TH>
                  <TH>Category</TH>
                  <TH>Amount</TH>
                  <TH>Note</TH>
                  <TH className="text-right">Date</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-card/50 transition">
                    <TD>
                      <span className="font-semibold text-foreground">{e.vendor}</span>
                    </TD>
                    <TD>
                      <Pill tone="plain">{e.category || "General"}</Pill>
                    </TD>
                    <TD>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        -{money(e.amount)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs text-muted-foreground">{e.note || "—"}</span>
                    </TD>
                    <TD className="text-right">
                      <span className="text-xs text-muted-foreground">{fmtDate(e.date)}</span>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Log Expense Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">Log Agency Expense</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Record tools, hosting, and operational costs.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Vendor / Payee *
                </label>
                <input
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="e.g. Google Cloud, Lovable, GitHub"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Note / Purpose (Optional)
                </label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Monthly server cluster renewal"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => addExpenseMutation.mutate()}
                disabled={addExpenseMutation.isPending || !form.vendor.trim()}
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {addExpenseMutation.isPending ? "Logging…" : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
