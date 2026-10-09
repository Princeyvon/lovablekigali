import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  Receipt,
  Search,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Stat, Panel, Pill, Table, TH, TD, Empty } from "@/components/dash";
import { SearchInput, FilterSelect, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, paidThrough, dueState, todayISO } from "@/lib/agency";
import { fetchMergedClients } from "@/lib/pipeline-store";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Subscriptions — Lovable Solutions" },
      {
        name: "description",
        content: "Client retainer subscriptions, multi-month payments and accounts standing.",
      },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [billingDisplayMode, setBillingDisplayMode] = useState<"table" | "cards">("table");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedClientForPay, setSelectedClientForPay] = useState<string>("");

  const [paymentForm, setPaymentForm] = useState({
    client_id: "",
    amount: "1500",
    payment_date: todayISO(),
    months_covered: "1",
    covers_period_start: todayISO(),
    covers_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    note: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () =>
      (await supabase.from("payments").select("*").order("payment_date", { ascending: false }))
        .data ?? [],
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });

  // Calculate client billing status
  const clientBillingRows = useMemo(() => {
    return clients.map((c) => {
      const clientPays = payments.filter((p) => p.client_id === c.id);
      const sub = subs.find((s) => s.client_id === c.id);
      const latestThrough = paidThrough(clientPays);
      const due = dueState(latestThrough ?? c.signed_date);
      const rate = sub ? Number(sub.monthly_rate) : 1500;

      return {
        client: c,
        sub,
        rate,
        latestThrough,
        due,
        totalPaid: clientPays.reduce((acc, p) => acc + Number(p.amount || 0), 0),
        paymentsCount: clientPays.length,
      };
    });
  }, [clients, payments, subs]);

  const filteredRows = useMemo(() => {
    return clientBillingRows.filter((row) => {
      const matchQ = matches(
        q,
        row.client.business_name,
        row.client.contact_name,
        row.client.contact_email,
      );
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "overdue" && row.due.overdue) ||
        (statusFilter === "current" && !row.due.overdue) ||
        (statusFilter === "grace" && row.due.inGrace);
      return matchQ && matchStatus;
    });
  }, [clientBillingRows, q, statusFilter]);

  const mrr =
    subs.reduce((acc, s) => acc + Number(s.monthly_rate || 0), 0) || clients.length * 1500;
  const overdueCount = clientBillingRows.filter((r) => r.due.overdue).length;
  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentForm.client_id) throw new Error("Please select a client");
      const { error } = await supabase.from("payments").insert({
        client_id: paymentForm.client_id,
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        months_covered: Number(paymentForm.months_covered),
        covers_period_start: paymentForm.covers_period_start,
        covers_period_end: paymentForm.covers_period_end,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setIsPaymentOpen(false);
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openLogPayment = (clientId?: string) => {
    const targetId = clientId || (clients[0]?.id ?? "");
    const row = clientBillingRows.find((r) => r.client.id === targetId);
    const start = row?.latestThrough || todayISO();
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() + 30);
    const end = startDate.toISOString().slice(0, 10);

    setPaymentForm({
      client_id: targetId,
      amount: String(row?.rate || 1500),
      payment_date: todayISO(),
      months_covered: "1",
      covers_period_start: start,
      covers_period_end: end,
      note: "",
    });
    setIsPaymentOpen(true);
  };

  return (
    <AppShell
      title="Client Billing & Retainers"
      subtitle="Track recurring client subscriptions, advance multi-month coverages, and audit payment receipts."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search client billing…" />
          <FilterSelect
            label="Standing"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Standing" },
              { value: "current", label: "Current / Paid" },
              { value: "grace", label: "In Grace Period" },
              { value: "overdue", label: "Overdue" },
            ]}
          />
          <button
            onClick={() => openLogPayment()}
            className="gradient-leaf flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-90"
          >
            <Plus className="size-4" /> Log Payment
          </button>
        </div>
      }
    >
      {/* Top Stat Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Contracted MRR"
          value={money(mrr)}
          hint="Recurring monthly retainer"
          tone="leaf"
          icon={<CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Total Collected"
          value={money(totalCollected)}
          hint={`${payments.length} payments recorded`}
          tone="plain"
          icon={<Receipt className="size-4 text-blue-600 dark:text-blue-400" />}
        />
        <Stat
          label="Overdue Standing"
          value={String(overdueCount)}
          hint={overdueCount > 0 ? "Requires payment notice" : "All accounts up to date"}
          tone={overdueCount > 0 ? "warn" : "leaf"}
          icon={<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Active Accounts"
          value={String(clients.length)}
          hint="Serviced agency clients"
          tone="mist"
          icon={<CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />}
        />
      </div>

      {/* Main Billing Table */}
      <Panel
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-xs">
              <CreditCard className="size-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold text-foreground tracking-tight">
                Client Retainers & Standing
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {filteredRows.length} clients
              </span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
              <button
                type="button"
                onClick={() => setBillingDisplayMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  billingDisplayMode === "table"
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
                onClick={() => setBillingDisplayMode("cards")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  billingDisplayMode === "cards"
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
        {filteredRows.length === 0 ? (
          <Empty>No client billing records match the filter.</Empty>
        ) : billingDisplayMode === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <TH>Client Business</TH>
                  <TH>Monthly Rate</TH>
                  <TH>Paid Through</TH>
                  <TH>Standing</TH>
                  <TH>Total Invoiced</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRows.map((r) => (
                  <tr key={r.client.id} className="hover:bg-secondary/40 transition">
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-xs font-bold text-foreground">
                          {r.client.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            to="/clients/$id"
                            params={{ id: r.client.id }}
                            className="font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {r.client.business_name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {r.client.contact_name || "Primary contact"}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <span className="font-mono font-semibold text-foreground">
                        {money(r.rate)}/mo
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>{fmtDate(r.latestThrough)}</span>
                      </div>
                    </TD>
                    <TD>
                      <Pill tone={r.due.overdue ? (r.due.inGrace ? "mist" : "warn") : "leaf"}>
                        {r.due.overdue
                          ? r.due.inGrace
                            ? `Grace (${r.due.daysOverdue}d)`
                            : `Overdue (${r.due.daysOverdue}d)`
                          : "Current"}
                      </Pill>
                    </TD>
                    <TD>
                      <span className="font-mono text-xs text-muted-foreground">
                        {money(r.totalPaid)} ({r.paymentsCount}x)
                      </span>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openLogPayment(r.client.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary hover:text-foreground transition"
                        >
                          <Plus className="size-3" /> Log Payment
                        </button>
                        <Link
                          to="/clients/$id"
                          params={{ id: r.client.id }}
                          className="rounded-lg border border-border p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="View Client"
                        >
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD VIEW FOR CLIENT BILLING */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRows.map((r) => (
              <div
                key={r.client.id}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Top Row: Avatar, Client Name, Standing */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-xs font-bold text-foreground shadow-xs">
                        {r.client.business_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/clients/$id"
                          params={{ id: r.client.id }}
                          className="block truncate font-semibold text-foreground transition hover:text-primary hover:underline"
                          title={r.client.business_name}
                        >
                          {r.client.business_name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {r.client.contact_name || "Primary contact"}
                        </p>
                      </div>
                    </div>

                    <Pill tone={r.due.overdue ? (r.due.inGrace ? "mist" : "warn") : "leaf"}>
                      {r.due.overdue
                        ? r.due.inGrace
                          ? `Grace (${r.due.daysOverdue}d)`
                          : `Overdue (${r.due.daysOverdue}d)`
                        : "Current"}
                    </Pill>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                      <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                        Monthly Retainer
                      </span>
                      <span className="mt-0.5 block font-mono font-bold text-foreground">
                        {money(r.rate)}
                        <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                      <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                        Paid Through
                      </span>
                      <span className="mt-0.5 block font-mono text-xs font-semibold text-foreground">
                        {fmtDate(r.latestThrough)}
                      </span>
                    </div>
                  </div>

                  {/* Total Invoiced */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 px-1">
                    <span>Total Invoiced</span>
                    <span className="font-mono font-medium text-foreground">
                      {money(r.totalPaid)}{" "}
                      <span className="text-muted-foreground">({r.paymentsCount} payments)</span>
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <Link
                    to="/clients/$id"
                    params={{ id: r.client.id }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Client Details</span>
                    <ArrowRight className="size-3" />
                  </Link>

                  <button
                    onClick={() => openLogPayment(r.client.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <Plus className="size-3 text-primary" />
                    <span>Log Payment</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Recent Payments Ledger */}
      <Panel
        title="Recent Payment Transactions"
        right={<Pill tone="plain">{payments.length} total</Pill>}
      >
        {payments.length === 0 ? (
          <Empty>No payment transactions recorded yet.</Empty>
        ) : (
          <div className="space-y-2">
            {payments.slice(0, 10).map((p) => {
              const c = clients.find((x) => x.id === p.client_id);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">
                      {c?.business_name || "Direct Client Payment"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Covers: {fmtDate(p.covers_period_start)} to {fmtDate(p.covers_period_end)} (
                      {p.months_covered || 1} mo)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +{money(p.amount)}
                    </span>
                    <span className="rounded-lg bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground">
                      {fmtDate(p.payment_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Log Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card w-full max-w-lg rounded-2xl border border-border p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">Record Client Payment</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Enter payment details to extend the client's "paid through" period.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Client *</label>
                <select
                  value={paymentForm.client_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const r = clientBillingRows.find((x) => x.client.id === id);
                    setPaymentForm((prev) => ({
                      ...prev,
                      client_id: id,
                      amount: String(r?.rate || 1500),
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name}
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
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Months Covered *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={paymentForm.months_covered}
                    onChange={(e) => {
                      const m = Number(e.target.value) || 1;
                      const start = new Date(paymentForm.covers_period_start);
                      start.setDate(start.getDate() + m * 30);
                      setPaymentForm({
                        ...paymentForm,
                        months_covered: e.target.value,
                        covers_period_end: start.toISOString().slice(0, 10),
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={paymentForm.covers_period_start}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, covers_period_start: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Period End (Paid Through)
                  </label>
                  <input
                    type="date"
                    value={paymentForm.covers_period_end}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, covers_period_end: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => addPaymentMutation.mutate()}
                disabled={addPaymentMutation.isPending}
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {addPaymentMutation.isPending ? "Saving…" : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
