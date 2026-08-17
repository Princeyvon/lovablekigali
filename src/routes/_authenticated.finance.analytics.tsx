import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { FilterSelect } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { buildStanding, summarise, type ClientRow } from "@/lib/standing";
import { money, shortMoney } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/finance/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Lovable Solutions" },
      { name: "description", content: "Revenue, margin, churn, collection rate, sector mix and rep performance in RWF." },
      { property: "og:title", content: "Analytics — Lovable Solutions" },
      { property: "og:description", content: "Interactive performance metrics across revenue, pipeline and team." },
    ],
  }),
  component: Analytics,
});

const PIE_COLORS = ["var(--leaf)", "var(--leaf-deep)", "var(--mist)", "#8ec78f", "#3f6b47", "#c3ddaa"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
};

function monthKey(d: string | null | undefined) {
  return typeof d === "string" ? d.slice(0, 7) : null;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Analytics() {
  const [window, setWindow] = useState("12");
  const [methodFilter, setMethodFilter] = useState("all");

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

  const span = Number(window);

  const months = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.toISOString().slice(0, 7));
    }
    return keys;
  }, [span]);

  const scopedPayments = useMemo(
    () => payments.filter((p) => methodFilter === "all" || p.method === methodFilter),
    [payments, methodFilter],
  );

  const trend = useMemo(() => {
    const rev = new Map<string, number>();
    const exp = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const p of scopedPayments) {
      const k = monthKey(p.payment_date);
      if (!k) continue;
      rev.set(k, (rev.get(k) ?? 0) + Number(p.amount ?? 0));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const e of expenses) {
      const k = monthKey(e.date);
      if (k) exp.set(k, (exp.get(k) ?? 0) + Number(e.amount ?? 0));
    }
    let cumulative = 0;
    return months.map((m) => {
      const revenue = rev.get(m) ?? 0;
      const spend = exp.get(m) ?? 0;
      cumulative += revenue - spend;
      return {
        key: m,
        label: `${m.slice(5)}/${m.slice(2, 4)}`,
        revenue,
        spend,
        net: revenue - spend,
        cumulative,
        payments: counts.get(m) ?? 0,
      };
    });
  }, [scopedPayments, expenses, months]);

  const growth = useMemo(() => {
    const signedByMonth = new Map<string, number>();
    const churnByMonth = new Map<string, number>();
    for (const c of clients) {
      const k = monthKey(c.signed_date);
      if (k) signedByMonth.set(k, (signedByMonth.get(k) ?? 0) + 1);
      if (c.status === "Churned") {
        const ck = monthKey(c.suspended_at ?? c.signed_date);
        if (ck) churnByMonth.set(ck, (churnByMonth.get(ck) ?? 0) + 1);
      }
    }
    let running = clients.filter((c) => (monthKey(c.signed_date) ?? "") < (months[0] ?? "")).length;
    return months.map((m) => {
      running += (signedByMonth.get(m) ?? 0) - (churnByMonth.get(m) ?? 0);
      return {
        label: `${m.slice(5)}/${m.slice(2, 4)}`,
        signed: signedByMonth.get(m) ?? 0,
        churned: churnByMonth.get(m) ?? 0,
        base: Math.max(0, running),
      };
    });
  }, [clients, months]);

  const standing = useMemo(
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

  const totals = useMemo(() => {
    const revenue = scopedPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const spend = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const active = clients.filter((c) => c.status === "Active");
    const mrr = subs.filter((s) => s.status === "Active").reduce((s, x) => s + Number(x.monthly_rate ?? 0), 0);
    const churned = clients.filter((c) => c.status === "Churned").length;
    const invoiced = revenue + standing.totalOwed;
    const best = [...trend].sort((a, b) => b.revenue - a.revenue)[0];
    return {
      revenue,
      spend,
      profit: revenue - spend,
      margin: revenue ? Math.round(((revenue - spend) / revenue) * 100) : 0,
      mrr,
      arr: mrr * 12,
      active: active.length,
      churnRate: clients.length ? Math.round((churned / clients.length) * 100) : 0,
      arpu: active.length ? mrr / active.length : 0,
      avgPayment: scopedPayments.length ? revenue / scopedPayments.length : 0,
      collectionRate: invoiced ? Math.round((revenue / invoiced) * 100) : 100,
      best,
      ltv: active.length && churned ? (mrr / active.length) * (clients.length / Math.max(1, churned)) : 0,
    };
  }, [scopedPayments, expenses, clients, subs, standing, trend]);

  const methodMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) map.set(p.method ?? "Unknown", (map.get(p.method ?? "Unknown") ?? 0) + Number(p.amount ?? 0));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [payments]);

  const stageMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prospects) map.set(p.stage, (map.get(p.stage) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [prospects]);

  const sectors = useMemo(() => {
    const map = new Map<string, { count: number; mrr: number }>();
    for (const c of clients) {
      const key = c.industry || "Unspecified";
      const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
      const cur = map.get(key) ?? { count: 0, mrr: 0 };
      map.set(key, { count: cur.count + 1, mrr: cur.mrr + rate });
    }
    return [...map.entries()]
      .sort((a, b) => b[1].mrr - a[1].mrr)
      .slice(0, 8)
      .map(([name, v]) => ({ name, mrr: v.mrr, count: v.count }));
  }, [clients, subs]);

  const repRows = useMemo(
    () =>
      members
        .map((m) => {
          const own = clients.filter((c) => c.onboarded_by === m.id);
          const mrr = own.reduce((s, c) => s + Number(subs.find((x) => x.client_id === c.id)?.monthly_rate ?? 0), 0);
          const collected = payments
            .filter((p) => own.some((c) => c.id === p.client_id))
            .reduce((s, p) => s + Number(p.amount ?? 0), 0);
          const pipe = prospects.filter((p) => p.assigned_rep === m.id);
          const won = pipe.filter((p) => p.stage === "Signed").length;
          return {
            id: m.id,
            name: m.full_name,
            clients: own.length,
            mrr,
            collected,
            pipe: pipe.length,
            won,
            winRate: pipe.length ? Math.round((won / pipe.length) * 100) : 0,
          };
        })
        .sort((a, b) => b.mrr - a.mrr),
    [members, clients, subs, prospects, payments],
  );

  const radar = useMemo(() => {
    const maxMrr = Math.max(1, ...repRows.map((r) => r.mrr));
    const maxClients = Math.max(1, ...repRows.map((r) => r.clients));
    const maxPipe = Math.max(1, ...repRows.map((r) => r.pipe));
    return repRows.slice(0, 6).map((r) => ({
      name: r.name.split(" ")[0],
      MRR: Math.round((r.mrr / maxMrr) * 100),
      Clients: Math.round((r.clients / maxClients) * 100),
      Pipeline: Math.round((r.pipe / maxPipe) * 100),
      "Win rate": r.winRate,
    }));
  }, [repRows]);

  const methods = useMemo(() => [...new Set(payments.map((p) => p.method).filter(Boolean))] as string[], [payments]);
  const signed = prospects.filter((p) => p.stage === "Signed").length;
  const winRate = prospects.length ? Math.round((signed / prospects.length) * 100) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Performance across revenue, clients, pipeline and team.</p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Method"
            value={methodFilter}
            onChange={setMethodFilter}
            options={methods.map((m) => ({ value: m, label: m }))}
          />
          <div className="flex rounded-xl bg-secondary p-1 text-xs font-medium">
            {["6", "12", "24"].map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`rounded-lg px-3 py-1.5 ${window === w ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                {w}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Collected" value={shortMoney(totals.revenue)} hint={`${scopedPayments.length} payments`} tone="leaf" />
        <Stat label="Spent" value={shortMoney(totals.spend)} hint={`${expenses.length} expenses`} tone="mist" />
        <Stat label="Net" value={shortMoney(totals.profit)} hint={`${totals.margin}% margin`} tone="deep" />
        <Stat label="MRR" value={shortMoney(totals.mrr)} hint={`ARR ${shortMoney(totals.arr)}`} tone="leaf" />
      </div>

      <Panel title="Performance metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="ARPU" value={shortMoney(totals.arpu)} hint="Per active client / month" />
          <Metric label="Avg payment" value={shortMoney(totals.avgPayment)} hint="Per transaction" />
          <Metric label="Collection rate" value={`${totals.collectionRate}%`} hint="Collected vs invoiced" />
          <Metric label="Expected revenue" value={shortMoney(standing.expectedRevenue)} hint="Past grace window" />
          <Metric label="Total owed" value={shortMoney(standing.totalOwed)} hint={`${standing.overdue.length} overdue`} />
          <Metric label="Active clients" value={String(totals.active)} hint={`${totals.churnRate}% churn rate`} />
          <Metric label="Pipeline win rate" value={`${winRate}%`} hint={`${signed} of ${prospects.length} signed`} />
          <Metric
            label="Best month"
            value={totals.best ? shortMoney(totals.best.revenue) : "—"}
            hint={totals.best?.label ?? "No data"}
          />
        </div>
      </Panel>

      <Panel
        title="Revenue, spend and cumulative net"
        right={<Pill tone="mist">{span} months</Pill>}
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--leaf)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--leaf)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis
                tickFormatter={(v: number) => shortMoney(v)}
                tickLine={false}
                axisLine={false}
                width={72}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={28} />
              <Area name="Cumulative net" type="monotone" dataKey="cumulative" stroke="var(--leaf)" fill="url(#cumFill)" strokeWidth={2} />
              <Bar name="Revenue" dataKey="revenue" fill="var(--leaf)" radius={[6, 6, 0, 0]} maxBarSize={22} />
              <Bar name="Expenses" dataKey="spend" fill="var(--leaf-deep)" radius={[6, 6, 0, 0]} maxBarSize={22} />
              <Line name="Monthly net" type="monotone" dataKey="net" stroke="#c08a2e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Client base growth">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" height={28} />
                <Bar name="Signed" dataKey="signed" fill="var(--leaf)" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Bar name="Churned" dataKey="churned" fill="var(--leaf-deep)" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Line name="Client base" type="monotone" dataKey="base" stroke="#c08a2e" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Payment volume per month">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" height={28} />
                <Line name="Payments logged" type="monotone" dataKey="payments" stroke="var(--leaf)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Revenue by method">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methodMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {methodMix.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={28} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Pipeline by stage">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stageMix} dataKey="value" nameKey="name" outerRadius={90}>
                  {stageMix.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={28} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Rep strength profile">
          {radar.length === 0 ? (
            <Empty>No team data.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius={90}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Radar name="MRR index" dataKey="MRR" stroke="var(--leaf)" fill="var(--leaf)" fillOpacity={0.35} />
                  <Radar name="Win rate" dataKey="Win rate" stroke="var(--leaf-deep)" fill="var(--leaf-deep)" fillOpacity={0.2} />
                  <Legend verticalAlign="bottom" height={28} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Top sectors by MRR" right={<Pill tone="mist">{sectors.length}</Pill>}>
          {sectors.length === 0 ? (
            <Empty>No clients yet.</Empty>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sectors} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => shortMoney(v)} fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number, n: string) => [n === "MRR" ? money(v) : v, n]} contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" height={28} />
                  <Bar name="MRR" dataKey="mrr" fill="var(--leaf)" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
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
                <TH>Collected</TH>
                <TH>Pipeline</TH>
                <TH>Win rate</TH>
              </>
            }
          >
            {repRows.map((r) => (
              <tr key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.clients}</TD>
                <TD className="font-medium text-primary">{shortMoney(r.mrr)}</TD>
                <TD>{shortMoney(r.collected)}</TD>
                <TD>{r.pipe}</TD>
                <TD>{r.winRate}%</TD>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
