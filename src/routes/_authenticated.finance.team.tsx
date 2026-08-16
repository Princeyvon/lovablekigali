import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/finance/team")({
  head: () => ({
    meta: [
      { title: "Team — Finance — Lovable Solutions" },
      { name: "description", content: "Team directory with commissions earned, paid out and outstanding balance." },
      { property: "og:title", content: "Team — Lovable Solutions" },
      { property: "og:description", content: "Who earns what and what is still owed to them." },
    ],
  }),
  component: FinanceTeam,
});

function FinanceTeam() {
  const [q, setQ] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*").order("full_name")).data ?? [],
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ["payouts"],
    queryFn: async () =>
      (await supabase.from("team_payouts").select("*").order("date_sent", { ascending: false })).data ?? [],
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => (await supabase.from("commissions").select("*")).data ?? [],
  });

  const rows = useMemo(
    () =>
      members.map((m) => {
        const earned = commissions.filter((c) => c.rep_id === m.id).reduce((s, c) => s + Number(c.amount ?? 0), 0);
        const paid = payouts.filter((p) => p.team_member_id === m.id).reduce((s, p) => s + Number(p.amount ?? 0), 0);
        return { ...m, earned, paid, balance: earned - paid };
      }),
    [members, commissions, payouts],
  );

  const visible = rows.filter((m) => matches(q, m.full_name, m.role, m.email));
  const owed = rows.reduce((s, m) => s + Math.max(0, m.balance), 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="People" value={String(members.length)} hint={`${rows.filter((m) => m.active).length} active`} />
        <Stat label="Commissions earned" value={money(rows.reduce((s, m) => s + m.earned, 0))} tone="mist" />
        <Stat label="Still owed to team" value={money(owed)} tone="deep" />
      </div>

      <Panel
        title="Directory"
        right={<SearchInput value={q} onChange={setQ} placeholder="Search team…" />}
      >
        {visible.length === 0 ? (
          <Empty>No teammate matches “{q}”.</Empty>
        ) : (
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
            {visible.map((m) => (
              <tr key={m.id}>
                <TD className="font-medium">{m.full_name}</TD>
                <TD className="text-muted-foreground">{m.role}</TD>
                <TD>{money(m.earned)}</TD>
                <TD>{money(m.paid)}</TD>
                <TD className={m.balance > 0 ? "font-medium text-primary" : ""}>{money(m.balance)}</TD>
                <TD>{m.active ? <Pill tone="leaf">Active</Pill> : <Pill tone="muted">Inactive</Pill>}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
