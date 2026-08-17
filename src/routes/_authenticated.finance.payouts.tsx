import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { Combobox, SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, todayISO } from "@/lib/agency";

const PAYOUT_TYPES = ["Commission", "Salary", "Reimbursement"] as const;
const PAYOUT_METHODS = ["Mobile Money", "Bank", "Check"] as const;

export const Route = createFileRoute("/_authenticated/finance/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Finance — Lovable Solutions" },
      { name: "description", content: "Record and review every payout sent to the team in RWF." },
      { property: "og:title", content: "Payouts — Lovable Solutions" },
      { property: "og:description", content: "Commissions, salaries and reimbursements actually sent." },
    ],
  }),
  component: Payouts,
});

const field = "rounded-xl border border-input bg-background px-3 py-2 text-sm";

function Payouts() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    team_member_id: "",
    type: "Commission",
    amount: "",
    date_sent: todayISO(),
    method: "Mobile Money",
    reference: "",
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*").order("full_name")).data ?? [],
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ["payouts"],
    queryFn: async () =>
      (await supabase.from("team_payouts").select("*").order("date_sent", { ascending: false })).data ?? [],
  });

  const pay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_payouts").insert({
        team_member_id: form.team_member_id,
        type: form.type as (typeof PAYOUT_TYPES)[number],
        amount: Number(form.amount),
        date_sent: form.date_sent,
        method: form.method as (typeof PAYOUT_METHODS)[number],
        reference: form.reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout recorded");
      setForm({ ...form, amount: "", reference: "" });
      qc.invalidateQueries({ queryKey: ["payouts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "—";
  const visible = useMemo(
    () => payouts.filter((p) => matches(q, nameOf(p.team_member_id), p.type, p.method, p.reference)),
    [payouts, members, q],
  );
  const thisMonth = payouts
    .filter((p) => (p.date_sent ?? "").startsWith(todayISO().slice(0, 7)))
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <Stat label="Paid out all-time" value={money(payouts.reduce((s, p) => s + Number(p.amount ?? 0), 0))} />
        <Stat label="This month" value={money(thisMonth)} tone="mist" />
        <Stat label="Payouts logged" value={String(payouts.length)} tone="deep" />
      </div>

      {role === "admin" && (
        <Panel title="Send a payout">
          <div className="grid gap-3 md:grid-cols-3">
            <Combobox
              options={members.map((m) => ({ value: m.id, label: m.full_name, hint: m.role }))}
              value={form.team_member_id}
              onChange={(v) => setForm({ ...form, team_member_id: v })}
              placeholder="Select member…"
            />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
              {PAYOUT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount (RWF)"
              inputMode="numeric"
              className={field}
            />
            <input
              type="date"
              value={form.date_sent}
              onChange={(e) => setForm({ ...form, date_sent: e.target.value })}
              className={field}
            />
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field}>
              {PAYOUT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Reference"
              className={field}
            />
          </div>
          <button
            onClick={() => pay.mutate()}
            disabled={!form.team_member_id || !form.amount}
            className="gradient-leaf mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Record payout
          </button>
        </Panel>
      )}

      <Panel
        title="Payout history"
        right={
          <div className="flex items-center gap-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search payouts…" />
            <Pill tone="mist">{visible.length}</Pill>
          </div>
        }
      >
        {visible.length === 0 ? (
          <Empty>No payouts match.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Member</TH>
                <TH>Type</TH>
                <TH>Amount</TH>
                <TH>Sent</TH>
                <TH>Method</TH>
                <TH>Reference</TH>
              </>
            }
          >
            {visible.map((p) => (
              <tr key={p.id}>
                <TD className="font-medium">{nameOf(p.team_member_id)}</TD>
                <TD>{p.type}</TD>
                <TD className="font-medium text-primary">{money(p.amount)}</TD>
                <TD>{fmtDate(p.date_sent)}</TD>
                <TD>{p.method}</TD>
                <TD className="text-muted-foreground">{p.reference ?? "—"}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
