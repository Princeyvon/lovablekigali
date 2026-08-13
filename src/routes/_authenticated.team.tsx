import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, todayISO } from "@/lib/agency";

const PAYOUT_TYPES = ["Commission", "Salary", "Reimbursement"] as const;
const PAYOUT_METHODS = ["Mobile Money", "Bank", "Check"] as const;

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & payouts — Agency OS" },
      { name: "description", content: "Team roster, commissions earned and money sent out in RWF." },
      { property: "og:title", content: "Team & payouts — Agency OS" },
      { property: "og:description", content: "Roster, commissions and payouts in one place." },
    ],
  }),
  component: Team,
});

const field = "rounded-xl border border-input bg-background px-3 py-2 text-sm";

function Team() {
  const qc = useQueryClient();
  const { role } = useAuth();
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
    queryFn: async () => (await supabase.from("team_payouts").select("*").order("date_sent", { ascending: false })).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => (await supabase.from("commissions").select("*")).data ?? [],
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(
    () =>
      members.map((m) => {
        const earned = commissions.filter((c) => c.rep_id === m.id).reduce((s, c) => s + Number(c.amount), 0);
        const paid = payouts.filter((p) => p.team_member_id === m.id).reduce((s, p) => s + Number(p.amount), 0);
        return { ...m, earned, paid, balance: earned - paid };
      }),
    [members, commissions, payouts],
  );

  return (
    <AppShell title="Team & payouts" subtitle="Who earns what, and what has actually been sent.">
      <Panel title="Roster" right={<Pill tone="mist">{members.length} people</Pill>}>
        <Table
          head={
            <>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Commissions</TH>
              <TH>Paid out</TH>
              <TH>Balance</TH>
              <TH>Status</TH>
            </>
          }
        >
          {rows.map((m) => (
            <tr key={m.id}>
              <TD className="font-medium">{m.full_name}</TD>
              <TD>{m.role}</TD>
              <TD>{money(m.earned)}</TD>
              <TD>{money(m.paid)}</TD>
              <TD className={m.balance > 0 ? "font-medium text-primary" : ""}>{money(m.balance)}</TD>
              <TD>{m.active ? <Pill tone="leaf">Active</Pill> : <Pill tone="muted">Inactive</Pill>}</TD>
            </tr>
          ))}
        </Table>
      </Panel>

      {role === "admin" && (
        <Panel title="Send a payout">
          <div className="grid gap-3 md:grid-cols-3">
            <select value={form.team_member_id} onChange={(e) => setForm({ ...form, team_member_id: e.target.value })} className={field}>
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
              {PAYOUT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (RWF)" inputMode="numeric" className={field} />
            <input type="date" value={form.date_sent} onChange={(e) => setForm({ ...form, date_sent: e.target.value })} className={field} />
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field}>
              {PAYOUT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Reference" className={field} />
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

      <Panel title="Payout history">
        {payouts.length === 0 ? (
          <Empty>No payouts recorded.</Empty>
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
            {payouts.map((p) => (
              <tr key={p.id}>
                <TD className="font-medium">{members.find((m) => m.id === p.team_member_id)?.full_name ?? "—"}</TD>
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
    </AppShell>
  );
}
