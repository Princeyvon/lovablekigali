import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Bars, Donut, Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { money, shortMoney } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Agency OS" },
      { name: "description", content: "Revenue, churn, sector mix and rep performance across the agency in RWF." },
      { property: "og:title", content: "Analytics — Agency OS" },
      { property: "og:description", content: "Twelve-month revenue trend, sector mix and pipeline conversion." },
    ],
  }),
  component: Analytics,
});

function monthKey(d: string | null | undefined) {
  return typeof d === "string" ? d.slice(0, 7) : null;
}

function Analytics() {
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });
  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => (await supabase.from("prospects").select("*")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*")).data ?? [],
  });

  const months = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.toISOString().slice(0, 7));
    }
    return keys;
  }, []);

  const trend = useMemo(() => {
    const rev = new Map<string, number>();
    const exp = new Map<string, number>();
    for (const p of payments) {
      const k = monthKey(p.payment_date);
      if (k) rev.set(k, (rev.get(k) ?? 0) + Number(p.amount ?? 0));
    }
    for (const e of expenses) {
      const k = monthKey(e.date);
      if (k) exp.set(k, (exp.get(k) ?? 0) + Number(e.amount ?? 0));
    }
    return months.map((m) => ({
      label: m.slice(5),
      a: rev.get(m) ?? 0,
      b: exp.get(m) ?? 0,
    }));
  }, [payments, expenses, months]);

  const totals = useMemo(() => {
    const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const spend = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const active = clients.filter((c) => c.status === "Active");
    const mrr = subs.filter((s) => s.status === "Active").reduce((s, x) => s + Number(x.monthly_rate), 0);
    const churned = clients.filter((c) => c.status === "Churned").length;
    return {
      revenue,
      spend,
      profit: revenue - spend,
      mrr,
      active: active.length,
      churnRate: clients.length ? Math.round((churned / clients.length) * 100) : 0,
      arpu: active.length ? mrr / active.length : 0,
    };
  }, [payments, expenses, clients, subs]);

  const sectors = useMemo(() => {
    const map = new Map<string, { count: number; mrr: number }>();
    for (const c of clients) {
      const key = c.industry || "Unspecified";
      const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
      const cur = map.get(key) ?? { count: 0, mrr: 0 };
      map.set(key, { count: cur.count + 1, mrr: cur.mrr + rate });
    }
    return [...map.entries()].sort((a, b) => b[1].mrr - a[1].mrr).slice(0, 10);
  }, [clients, subs]);

  const repRows = useMemo(
    () =>
      members
        .map((m) => {
          const own = clients.filter((c) => c.onboarded_by === m.id);
          const mrr = own.reduce((s, c) => s + Number(subs.find((x) => x.client_id === c.id)?.monthly_rate ?? 0), 0);
          const pipe = prospects.filter((p) => p.assigned_rep === m.id);
          const won = pipe.filter((p) => p.stage === "Signed").length;
          return { id: m.id, name: m.full_name, clients: own.length, mrr, pipe: pipe.length, won };
        })
        .sort((a, b) => b.mrr - a.mrr),
    [members, clients, subs, prospects],
  );

  const signed = prospects.filter((p) => p.stage === "Signed").length;
  const maxSector = Math.max(1, ...sectors.map(([, v]) => v.mrr));

  return (
    <AppShell title="Analytics" subtitle="Twelve months of revenue, cost, sector mix and rep performance.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Collected" value={shortMoney(totals.revenue)} hint="All payments" tone="leaf" />
        <Stat label="Spent" value={shortMoney(totals.spend)} hint="All expenses" tone="mist" />
        <Stat label="Net" value={shortMoney(totals.profit)} hint="Revenue − expenses" tone="deep" />
        <Stat label="MRR" value={shortMoney(totals.mrr)} hint={`ARPU ${shortMoney(totals.arpu)}`} tone="leaf" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue vs expenses"
          right={
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="gradient-leaf size-2.5 rounded-full" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[var(--leaf-deep)]" /> Expenses
              </span>
            </div>
          }
        >
          <Bars data={trend} />
        </Panel>

        <Panel title="Pipeline conversion">
          <Donut value={signed} total={prospects.length} caption="prospects signed" />
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="gradient-mist rounded-2xl border border-border p-3">
              <p className="font-display text-lg font-semibold">{totals.active}</p>
              <p className="text-xs text-muted-foreground">Active clients</p>
            </div>
            <div className="gradient-mist rounded-2xl border border-border p-3">
              <p className="font-display text-lg font-semibold">{totals.churnRate}%</p>
              <p className="text-xs text-muted-foreground">Churn rate</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Top sectors by MRR" right={<Pill tone="mist">{sectors.length}</Pill>}>
          {sectors.length === 0 ? (
            <Empty>No clients yet.</Empty>
          ) : (
            <div className="space-y-3">
              {sectors.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {name} <span className="text-muted-foreground">· {v.count}</span>
                    </span>
                    <span className="text-muted-foreground">{money(v.mrr)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="gradient-bar h-full rounded-full" style={{ width: `${(v.mrr / maxSector) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Rep performance">
          <Table
            head={
              <>
                <TH>Rep</TH>
                <TH>Clients</TH>
                <TH>MRR</TH>
                <TH>Pipeline</TH>
                <TH>Won</TH>
              </>
            }
          >
            {repRows.map((r) => (
              <tr key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.clients}</TD>
                <TD className="font-medium text-primary">{shortMoney(r.mrr)}</TD>
                <TD>{r.pipe}</TD>
                <TD>{r.won}</TD>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </AppShell>
  );
}
