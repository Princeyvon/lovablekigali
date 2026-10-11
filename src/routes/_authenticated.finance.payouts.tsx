import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Search,
  Smartphone,
  Landmark,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { FINANCE_TABS } from "@/routes/_authenticated.finance";
import { Stat, Panel, Pill, Table, TH, TD, Empty } from "@/components/dash";
import { SearchInput, FilterSelect, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money, todayISO } from "@/lib/agency";
import { PRINCE_MEMBER_ID, PRINCE_MEMBER_NAME } from "@/lib/pipeline-store";

export const Route = createFileRoute("/_authenticated/finance/payouts")({
  head: () => ({
    meta: [
      { title: "Team Payouts — Lovable Solutions" },
      {
        name: "description",
        content: "Team compensation, commission releases and contractor payments.",
      },
    ],
  }),
  component: PayoutsPage,
});

function PayoutsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isOpen, setIsOpen] = useState(false);

  const [form, setForm] = useState({
    team_member_id: PRINCE_MEMBER_ID,
    type: "Commission" as "Commission" | "Salary" | "Reimbursement",
    amount: "500",
    date_sent: todayISO(),
    method: "Mobile Money" as "Mobile Money" | "Bank" | "Check",
    reference: "MOMO-" + Math.floor(100000 + Math.random() * 900000),
    note: "",
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*")).data ?? [],
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["team_payouts"],
    queryFn: async () =>
      (await supabase.from("team_payouts").select("*").order("date_sent", { ascending: false }))
        .data ?? [],
  });

  const totalPayouts = payouts.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const momoPayouts = payouts
    .filter((p) => p.method === "Mobile Money")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      const member = members.find((m) => m.id === p.team_member_id);
      const matchQ = matches(q, member?.full_name, p.reference, p.note, p.type);
      const matchMethod = methodFilter === "all" || p.method === methodFilter;
      const matchType = typeFilter === "all" || p.type === typeFilter;
      return matchQ && matchMethod && matchType;
    });
  }, [payouts, members, q, methodFilter, typeFilter]);

  const addPayoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_payouts").insert({
        team_member_id: form.team_member_id,
        type: form.type,
        amount: Number(form.amount),
        date_sent: form.date_sent,
        method: form.method,
        reference: form.reference || null,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout record saved");
      setIsOpen(false);
      qc.invalidateQueries({ queryKey: ["team_payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Team Payouts & Disbursements"
      subtitle="Track money distributed to agency team members (salaries, commissions, and expense reimbursements)."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search payouts…" />
          <FilterSelect
            label="Method"
            value={methodFilter}
            onChange={setMethodFilter}
            options={[
              { value: "all", label: "All Methods" },
              { value: "Mobile Money", label: "Mobile Money" },
              { value: "Bank", label: "Bank Transfer" },
              { value: "Check", label: "Check" },
            ]}
          />
          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All Types" },
              { value: "Commission", label: "Commission" },
              { value: "Salary", label: "Salary" },
              { value: "Reimbursement", label: "Reimbursement" },
            ]}
          />
          <button
            onClick={() => setIsOpen(true)}
            className="gradient-leaf flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-90"
          >
            <Plus className="size-4" /> Record Payout
          </button>
        </div>
      }
    >
      <SubTabs tabs={FINANCE_TABS} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Distributed"
          value={money(totalPayouts)}
          hint={`${payouts.length} transactions sent`}
          tone="leaf"
          icon={<Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Mobile Money Payouts"
          value={money(momoPayouts)}
          hint="MTN / Airtel instant transfers"
          tone="mist"
          icon={<Smartphone className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Recent Transfers"
          value={String(payouts.slice(0, 30).length)}
          hint="Last 30 recorded disbursements"
          tone="plain"
          icon={<ArrowUpRight className="size-4 text-sky-600 dark:text-sky-400" />}
        />
        <Stat
          label="Recipient Staff"
          value={String(new Set(payouts.map((p) => p.team_member_id)).size)}
          hint="Team members compensated"
          tone="deep"
          icon={<CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />}
        />
      </div>

      {/* Payouts Table */}
      <Panel
        title="Disbursement Records"
        right={<Pill tone="mist">{filteredPayouts.length} payouts</Pill>}
      >
        {filteredPayouts.length === 0 ? (
          <Empty>No payouts recorded matching the filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <TH>Team Member</TH>
                  <TH>Disbursement Type</TH>
                  <TH>Payment Method</TH>
                  <TH>Amount</TH>
                  <TH>Reference</TH>
                  <TH className="text-right">Date Sent</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPayouts.map((p) => {
                  const m = members.find((x) => x.id === p.team_member_id);
                  const isMomo = p.method === "Mobile Money";
                  const isBank = p.method === "Bank";

                  return (
                    <tr key={p.id} className="hover:bg-card/50 transition">
                      <TD>
                        <p className="font-semibold text-foreground">
                          {m?.full_name || "Team Member"}
                        </p>
                        <p className="text-xs text-muted-foreground">{m?.role || "Staff"}</p>
                      </TD>
                      <TD>
                        <Pill
                          tone={
                            p.type === "Commission"
                              ? "leaf"
                              : p.type === "Salary"
                                ? "deep"
                                : "plain"
                          }
                        >
                          {p.type}
                        </Pill>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          {isMomo ? (
                            <Smartphone className="size-3.5 text-amber-500" />
                          ) : isBank ? (
                            <Landmark className="size-3.5 text-blue-500" />
                          ) : (
                            <FileText className="size-3.5 text-muted-foreground" />
                          )}
                          <span>{p.method}</span>
                        </div>
                      </TD>
                      <TD>
                        <span className="font-mono font-bold text-foreground">
                          -{money(p.amount)}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.reference || "—"}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(p.date_sent)}
                        </span>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Record Payout Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">Record Payout to Team</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Log salary, commission, or reimbursement sent to a member.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Recipient *</label>
                <select
                  value={form.team_member_id ?? ""}
                  onChange={(e) => setForm({ ...form, team_member_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as "Commission" | "Salary" | "Reimbursement",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Commission">Commission</option>
                    <option value="Salary">Salary</option>
                    <option value="Reimbursement">Reimbursement</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Method</label>
                  <select
                    value={form.method}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        method: e.target.value as "Mobile Money" | "Bank" | "Check",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
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
                  <label className="text-xs font-semibold text-muted-foreground">Date Sent</label>
                  <input
                    type="date"
                    value={form.date_sent}
                    onChange={(e) => setForm({ ...form, date_sent: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Reference / Transaction ID
                </label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="e.g. MOMO-982314 or Check #1042"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Note (Optional)
                </label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Commission for signing Kigali Innovations"
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
                onClick={() => addPayoutMutation.mutate()}
                disabled={addPayoutMutation.isPending}
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {addPayoutMutation.isPending ? "Recording…" : "Save Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
