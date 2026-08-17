import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { GRACE_DAYS, daysUntil, fmtDate, money, paidThrough, shortMoney, startOfWeek } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Finance — Lovable Solutions" },
      { name: "description", content: "Written weekly and monthly business reports with charts covering revenue, clients, pipeline and costs." },
      { property: "og:title", content: "Reports — Lovable Solutions" },
      { property: "og:description", content: "A narrative account of everything that happened in the chosen week or month." },
    ],
  }),
  component: Reports,
});

const PIE_COLORS = ["var(--leaf)", "var(--leaf-deep)", "var(--leaf-soft)", "var(--muted-foreground)", "var(--border)"];

type Period = { label: string; start: Date; end: Date; prevStart: Date; prevEnd: Date };

function buildPeriods(mode: "week" | "month"): Period[] {
  const out: Period[] = [];
  const now = new Date();
  if (mode === "week") {
    for (let i = 0; i < 12; i++) {
      const start = startOfWeek(now);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      out.push({
        label: `Week of ${start.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}`,
        start,
        end,
        prevStart,
        prevEnd: start,
      });
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      out.push({
        label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        start,
        end,
        prevStart,
        prevEnd: start,
      });
    }
  }
  return out;
}

const within = (d: string | null | undefined, a: Date, b: Date) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= a.getTime() && t < b.getTime();
};

function pct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function direction(n: number) {
  return n > 0 ? "up" : n < 0 ? "down" : "flat";
}

function Page({ n, title, kicker, children }: { n: number; title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="surface-card gradient-halo overflow-hidden px-6 py-6 md:px-10 md:py-9">
      <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{kicker}</p>
          <h2 className="font-display mt-1 text-2xl font-semibold">{title}</h2>
        </div>
        <span className="font-display text-sm text-muted-foreground">Page {n}</span>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl space-y-3 text-[15px] leading-7 text-foreground/85">{children}</div>;
}

const tip = {
  contentStyle: { borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" },
};

function Reports() {
  const [mode, setMode] = useState<"week" | "month">("month");
  const [index, setIndex] = useState(0);
  const periods = useMemo(() => buildPeriods(mode), [mode]);
  const period = periods[index] ?? periods[0]!;

  const q = <T,>(key: string, table: string) =>
    useQuery({
      queryKey: [key],
      queryFn: async () => ((await supabase.from(table as never).select("*")).data ?? []) as T[],
    });

  const { data: payments = [] } = q<any>("payments", "payments");
  const { data: expenses = [] } = q<any>("expenses", "expenses");
  const { data: clients = [] } = q<any>("clients", "clients");
  const { data: subs = [] } = q<any>("subs", "subscriptions");
  const { data: prospects = [] } = q<any>("prospects", "prospects");
  const { data: members = [] } = q<any>("members", "team_members");
  const { data: payouts = [] } = q<any>("payouts", "team_payouts");

  const r = useMemo(() => {
    const { start, end, prevStart, prevEnd } = period;

    const pIn = payments.filter((p: any) => within(p.payment_date, start, end));
    const pPrev = payments.filter((p: any) => within(p.payment_date, prevStart, prevEnd));
    const eIn = expenses.filter((e: any) => within(e.date, start, end));
    const ePrev = expenses.filter((e: any) => within(e.date, prevStart, prevEnd));
    const poIn = payouts.filter((p: any) => within(p.date_sent, start, end));
    const newClients = clients.filter((c: any) => within(c.signed_date, start, end));
    const newProspects = prospects.filter((p: any) => within(p.created_at, start, end));
    const churned = clients.filter((c: any) => c.status === "Churned");

    const sum = (rows: any[], k: string) => rows.reduce((s, x) => s + Number(x[k] ?? 0), 0);
    const revenue = sum(pIn, "amount");
    const revenuePrev = sum(pPrev, "amount");
    const spend = sum(eIn, "amount") + sum(poIn, "amount");
    const spendPrev = sum(ePrev, "amount");

    const methods = new Map<string, number>();
    for (const p of pIn) methods.set(p.method ?? "Unknown", (methods.get(p.method ?? "Unknown") ?? 0) + Number(p.amount ?? 0));

    const categories = new Map<string, number>();
    for (const e of eIn) categories.set(e.category ?? "General", (categories.get(e.category ?? "General") ?? 0) + Number(e.amount ?? 0));

    const stages = new Map<string, number>();
    for (const p of prospects) stages.set(p.stage, (stages.get(p.stage) ?? 0) + 1);

    const standing = clients.map((c: any) => {
      const through = paidThrough(payments.filter((p: any) => p.client_id === c.id));
      const days = daysUntil(through);
      return { ...c, through, days };
    });
    const overdue = standing.filter((c: any) => c.days !== null && c.days < 0);
    const pastGrace = overdue.filter((c: any) => Math.abs(c.days) > GRACE_DAYS);
    const owed = pastGrace.reduce((s: number, c: any) => {
      const rate = Number(subs.find((x: any) => x.client_id === c.id)?.monthly_rate ?? 0);
      return s + rate * Math.max(1, Math.ceil(Math.abs(c.days) / 30));
    }, 0);

    const mrr = subs.filter((s: any) => s.status === "Active").reduce((s: number, x: any) => s + Number(x.monthly_rate), 0);

    // daily/weekly series inside the period
    const buckets: { label: string; revenue: number; spend: number }[] = [];
    const cursor = new Date(start);
    const step = mode === "week" ? 1 : 7;
    while (cursor < end) {
      const bEnd = new Date(cursor);
      bEnd.setDate(bEnd.getDate() + step);
      buckets.push({
        label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
        revenue: sum(payments.filter((p: any) => within(p.payment_date, cursor, bEnd)), "amount"),
        spend: sum(expenses.filter((e: any) => within(e.date, cursor, bEnd)), "amount"),
      });
      cursor.setDate(cursor.getDate() + step);
    }

    const repRows = members
      .map((m: any) => ({
        id: m.id,
        name: m.full_name,
        signed: newClients.filter((c: any) => c.onboarded_by === m.id).length,
        leads: newProspects.filter((p: any) => p.assigned_rep === m.id).length,
        collected: pIn
          .filter((p: any) => clients.find((c: any) => c.id === p.client_id)?.onboarded_by === m.id)
          .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0),
      }))
      .sort((a, b) => b.collected - a.collected);

    const bestDay = [...buckets].sort((a, b) => b.revenue - a.revenue)[0];

    // extra metrics for the long-form report
    const activeSubs = subs.filter((s: any) => s.status === "Active");
    const activeCount = clients.filter((c: any) => c.status === "Active").length;
    const arpu = activeCount ? mrr / activeCount : 0;
    const avgTicket = pIn.length ? revenue / pIn.length : 0;
    const collectible = mrr + owed;
    const collectionRate = collectible ? Math.round((revenue / collectible) * 100) : 0;
    const runway = spend ? revenue / spend : 0;
    const churnRate = clients.length ? Math.round((churned.length / clients.length) * 100) : 0;
    const avgTenure = clients.length
      ? Math.round(
          clients.reduce((s: number, c: any) => s + (Date.now() - new Date(c.signed_date).getTime()) / 86400000, 0) /
            clients.length,
        )
      : 0;
    const ltv = arpu * (churnRate > 0 ? 100 / churnRate : 24);

    const sectorMap = new Map<string, { name: string; clients: number; mrr: number }>();
    for (const c of clients) {
      const key = c.industry || "Unspecified";
      const row = sectorMap.get(key) ?? { name: key, clients: 0, mrr: 0 };
      row.clients += 1;
      row.mrr += Number(subs.find((s: any) => s.client_id === c.id)?.monthly_rate ?? 0);
      sectorMap.set(key, row);
    }
    const sectorRows = [...sectorMap.values()].sort((a, b) => b.mrr - a.mrr);

    const topClients = clients
      .map((c: any) => ({
        name: c.business_name,
        collected: payments
          .filter((p: any) => p.client_id === c.id)
          .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0),
        rate: Number(subs.find((s: any) => s.client_id === c.id)?.monthly_rate ?? 0),
      }))
      .sort((a, b) => b.collected - a.collected);
    const topFiveShare = revenue
      ? Math.round((topClients.slice(0, 5).reduce((s, c) => s + c.rate, 0) / Math.max(mrr, 1)) * 100)
      : 0;

    // trailing 6 periods
    const trailing: { label: string; revenue: number; spend: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const s = new Date(start);
      const e2 = new Date(end);
      if (mode === "week") {
        s.setDate(s.getDate() - i * 7);
        e2.setDate(e2.getDate() - i * 7);
      } else {
        s.setMonth(s.getMonth() - i);
        e2.setMonth(e2.getMonth() - i);
      }
      const rev = sum(payments.filter((p: any) => within(p.payment_date, s, e2)), "amount");
      const sp = sum(expenses.filter((x: any) => within(x.date, s, e2)), "amount");
      trailing.push({
        label: mode === "week" ? `${s.getDate()}/${s.getMonth() + 1}` : s.toLocaleString("en", { month: "short" }),
        revenue: rev,
        spend: sp,
        net: rev - sp,
      });
    }
    const bestTrailing = [...trailing].sort((a, b) => b.revenue - a.revenue)[0];
    const worstTrailing = [...trailing].sort((a, b) => a.revenue - b.revenue)[0];

    const appLive = clients.filter((c: any) => c.app_status === "Live").length;
    const appSuspended = clients.filter((c: any) => c.app_status === "Suspended").length;
    const appClosed = clients.filter((c: any) => c.app_status === "Closed").length;

    const conversion = prospects.length
      ? Math.round((prospects.filter((p: any) => p.stage === "Signed").length / prospects.length) * 100)
      : 0;
    const lostRate = prospects.length
      ? Math.round((prospects.filter((p: any) => p.stage === "Lost").length / prospects.length) * 100)
      : 0;

    return {
      arpu,
      avgTicket,
      collectionRate,
      runway,
      churnRate,
      avgTenure,
      ltv,
      sectorRows,
      topClients,
      topFiveShare,
      trailing,
      bestTrailing,
      worstTrailing,
      appLive,
      appSuspended,
      appClosed,
      conversion,
      lostRate,
      activeSubs,
      pIn,
      eIn,
      poIn,
      revenue,
      revenuePrev,
      revenueDelta: pct(revenue, revenuePrev),
      spend,
      spendPrev,
      spendDelta: pct(spend, spendPrev),
      net: revenue - spend,
      newClients,
      newProspects,
      churned,
      overdue,
      pastGrace,
      owed,
      mrr,
      methods: [...methods.entries()].map(([name, value]) => ({ name, value })),
      categories: [...categories.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      stages: [...stages.entries()].map(([name, value]) => ({ name, value })),
      buckets,
      repRows,
      bestDay,
      signedThisPeriod: prospects.filter((p: any) => p.stage === "Signed").length,
      activeClients: clients.filter((c: any) => c.status === "Active").length,
      suspended: clients.filter((c: any) => c.app_status !== "Live"),
    };
  }, [period, mode, payments, expenses, clients, subs, prospects, members, payouts]);

  const unit = mode === "week" ? "week" : "month";
  const topRep = r.repRows[0];

  return (
    <>
      <Panel
        title="Report builder"
        right={<Pill tone="mist">{period.label}</Pill>}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-secondary p-1 text-xs font-medium">
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setIndex(0);
                }}
                className={`rounded-lg px-4 py-1.5 capitalize ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                {m}ly
              </button>
            ))}
          </div>
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {periods.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Print / save as PDF
          </button>
        </div>
      </Panel>

      {/* PAGE 1 */}
      <Page n={1} kicker={period.label} title="Executive summary">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Collected" value={shortMoney(r.revenue)} hint={`${r.revenueDelta >= 0 ? "+" : ""}${r.revenueDelta}% vs last ${unit}`} tone="leaf" />
          <Stat label="Spent" value={shortMoney(r.spend)} hint={`${r.spendDelta >= 0 ? "+" : ""}${r.spendDelta}% vs last ${unit}`} tone="mist" />
          <Stat label="Net" value={shortMoney(r.net)} hint="Collected − expenses & payouts" tone="deep" />
          <Stat label="Expected revenue" value={shortMoney(r.owed)} hint={`${r.pastGrace.length} apps past grace`} />
        </div>

        <Prose>
          <p>
            During <strong>{period.label.toLowerCase()}</strong> the business collected{" "}
            <strong>{money(r.revenue)}</strong> across {r.pIn.length} payment
            {r.pIn.length === 1 ? "" : "s"}. That is {Math.abs(r.revenueDelta)}%{" "}
            {direction(r.revenueDelta)} on the previous {unit}, which closed at {money(r.revenuePrev)}. Money going
            out totalled <strong>{money(r.spend)}</strong> — {r.eIn.length} expense entries and {r.poIn.length} team
            payout{r.poIn.length === 1 ? "" : "s"} — leaving a net position of <strong>{money(r.net)}</strong> for the
            period.
          </p>
          <p>
            The recurring base stands at <strong>{money(r.mrr)}</strong> in monthly recurring revenue from{" "}
            {r.activeClients} active clients. {r.newClients.length === 0
              ? "No new client signed in this period"
              : `${r.newClients.length} new client${r.newClients.length === 1 ? "" : "s"} signed`}
            , while {r.newProspects.length} fresh prospect{r.newProspects.length === 1 ? " entered" : "s entered"} the
            pipeline.
          </p>
          <p>
            On the collection side, {r.overdue.length} account{r.overdue.length === 1 ? " is" : "s are"} past their
            paid-through date, and {r.pastGrace.length} of those have crossed the {GRACE_DAYS}-day grace window — the
            money still expected from that group is <strong>{money(r.owed)}</strong>.{" "}
            {r.suspended.length > 0
              ? `${r.suspended.length} client app${r.suspended.length === 1 ? " is" : "s are"} currently not live.`
              : "Every client app is currently live."}
          </p>
        </Prose>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={r.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickFormatter={(v: number) => shortMoney(v)} width={70} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => money(v)} {...tip} />
              <Legend verticalAlign="top" height={24} />
              <Line name="Collected" type="monotone" dataKey="revenue" stroke="var(--leaf)" strokeWidth={2.5} dot={false} />
              <Line name="Spent" type="monotone" dataKey="spend" stroke="var(--leaf-deep)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Page>

      {/* PAGE 2 */}
      <Page n={2} kicker="Money in" title="Revenue and collections">
        <Prose>
          <p>
            Every franc collected in this {unit} arrived through one of three channels: mobile money, bank transfer or
            cash. {r.methods.length === 0
              ? "No payments were recorded, so there is nothing to split by method."
              : `The largest channel was ${[...r.methods].sort((a, b) => b.value - a.value)[0]!.name}, accounting for ${money(
                  [...r.methods].sort((a, b) => b.value - a.value)[0]!.value,
                )} of the ${money(r.revenue)} total.`}{" "}
            {r.bestDay && r.bestDay.revenue > 0
              ? `The strongest stretch was ${r.bestDay.label}, which alone brought in ${money(r.bestDay.revenue)}.`
              : ""}
          </p>
          <p>
            Payments are logged against the period they cover rather than the day they land, so a single transfer can
            settle several months at once. That is why the paid-through dates on the client list move further than the
            cash figure alone suggests.
          </p>
        </Prose>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={r.methods} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                  {r.methods.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} {...tip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickFormatter={(v: number) => shortMoney(v)} width={70} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => money(v)} {...tip} />
                <Legend verticalAlign="top" height={24} />
                <Bar name="Collected" dataKey="revenue" fill="var(--leaf)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {r.pIn.length === 0 ? (
          <Empty>No payments were recorded in this period.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Date</TH>
                <TH>Client</TH>
                <TH>Method</TH>
                <TH>Months</TH>
                <TH className="text-right">Amount</TH>
              </>
            }
          >
            {r.pIn.slice(0, 40).map((p: any) => (
              <tr key={p.id}>
                <TD>{fmtDate(p.payment_date)}</TD>
                <TD className="font-medium">{clients.find((c: any) => c.id === p.client_id)?.business_name ?? "—"}</TD>
                <TD>{p.method}</TD>
                <TD>{p.months_covered}</TD>
                <TD className="text-right font-medium text-primary">{money(p.amount)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Page>

      {/* PAGE 3 */}
      <Page n={3} kicker="Clients" title="Client base and app health">
        <Prose>
          <p>
            The roster closed the {unit} at {clients.length} clients, {r.activeClients} of them active and{" "}
            {r.churned.length} marked churned overall.{" "}
            {r.newClients.length > 0
              ? `New this ${unit}: ${r.newClients.map((c: any) => c.business_name).slice(0, 6).join(", ")}${
                  r.newClients.length > 6 ? ` and ${r.newClients.length - 6} more` : ""
                }.`
              : `No new business was signed this ${unit}.`}
          </p>
          <p>
            Collections discipline is measured against each client's paid-through date. {r.overdue.length} account
            {r.overdue.length === 1 ? "" : "s"} sit behind that date right now. Reminders go out every two days while a
            client is inside the {GRACE_DAYS}-day grace window; only after the window closes may an app be suspended,
            and {r.pastGrace.length} account{r.pastGrace.length === 1 ? " has" : "s have"} reached that point.
          </p>
        </Prose>

        {r.overdue.length === 0 ? (
          <Empty>Every client is paid through — nothing overdue this period.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH>Paid through</TH>
                <TH>Overdue by</TH>
                <TH>App status</TH>
              </>
            }
          >
            {r.overdue.slice(0, 30).map((c: any) => (
              <tr key={c.id}>
                <TD className="font-medium">{c.business_name}</TD>
                <TD>{fmtDate(c.through)}</TD>
                <TD>
                  {Math.abs(c.days) > GRACE_DAYS ? (
                    <Pill tone="warn">{Math.abs(c.days)}d — past grace</Pill>
                  ) : (
                    <Pill tone="mist">{Math.abs(c.days)}d</Pill>
                  )}
                </TD>
                <TD>{c.app_status}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Page>

      {/* PAGE 4 */}
      <Page n={4} kicker="Growth" title="Pipeline and team performance">
        <Prose>
          <p>
            {r.newProspects.length} prospect{r.newProspects.length === 1 ? "" : "s"} entered the pipeline this {unit}.
            Across all time the pipeline holds {prospects.length} records, of which {r.signedThisPeriod} have reached
            the signed stage.
          </p>
          <p>
            {topRep
              ? `${topRep.name} led the period with ${money(topRep.collected)} collected from their accounts, ${topRep.signed} new signing${
                  topRep.signed === 1 ? "" : "s"
                } and ${topRep.leads} new lead${topRep.leads === 1 ? "" : "s"} added.`
              : "No team members are on the roster yet, so there is nothing to attribute."}
          </p>
        </Prose>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={r.stages} dataKey="value" nameKey="name" outerRadius={95} paddingAngle={2}>
                  {r.stages.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.repRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickFormatter={(v: number) => shortMoney(v)} width={70} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => money(v)} {...tip} />
                <Legend verticalAlign="top" height={24} />
                <Bar name="Collected by rep" dataKey="collected" fill="var(--leaf)" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Table
          head={
            <>
              <TH>Rep</TH>
              <TH>New leads</TH>
              <TH>Signed</TH>
              <TH className="text-right">Collected</TH>
            </>
          }
        >
          {r.repRows.map((m) => (
            <tr key={m.id}>
              <TD className="font-medium">{m.name}</TD>
              <TD>{m.leads}</TD>
              <TD>{m.signed}</TD>
              <TD className="text-right font-medium text-primary">{money(m.collected)}</TD>
            </tr>
          ))}
        </Table>
      </Page>

      {/* PAGE 5 */}
      <Page n={5} kicker="Money out" title="Costs, payouts and outlook">
        <Prose>
          <p>
            Operating costs for the {unit} came to {money(r.eIn.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0))}{" "}
            across {r.eIn.length} entries, and {money(r.poIn.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))}{" "}
            went out as team payouts.{" "}
            {r.categories.length > 0
              ? `The heaviest category was ${r.categories[0]!.name} at ${money(r.categories[0]!.value)}.`
              : "No expense categories were recorded."}
          </p>
          <p>
            Netting everything, the {unit} finished at <strong>{money(r.net)}</strong>. Looking forward, the recurring
            base of {money(r.mrr)} per month plus {money(r.owed)} of expected revenue from past-grace accounts is the
            realistic near-term ceiling — collecting the overdue balance is the single fastest lever available.
          </p>
        </Prose>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.categories} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => shortMoney(v)} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => money(v)} {...tip} />
              <Legend verticalAlign="top" height={24} />
              <Bar name="Spent by category" dataKey="value" fill="var(--leaf-deep)" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Expenses" value={shortMoney(r.eIn.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0))} tone="mist" />
          <Stat label="Payouts" value={shortMoney(r.poIn.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0))} tone="deep" />
          <Stat label="Net for the period" value={shortMoney(r.net)} tone="leaf" />
        </div>
      </Page>

      {/* PAGE 6 */}
      <Page n={6} kicker="Unit economics" title="What each client is worth">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="ARPU / month" value={shortMoney(r.arpu)} hint="MRR ÷ active clients" tone="leaf" />
          <Stat label="Average ticket" value={shortMoney(r.avgTicket)} hint={`${r.pIn.length} payments this ${unit}`} tone="mist" />
          <Stat label="Estimated LTV" value={shortMoney(r.ltv)} hint="ARPU × expected lifetime" tone="deep" />
          <Stat label="Average tenure" value={`${r.avgTenure}d`} hint="Since signing date" />
        </div>
        <Prose>
          <p>
            Each active client contributes an average of <strong>{money(r.arpu)}</strong> per month, and the typical
            payment recorded this {unit} was {money(r.avgTicket)} — the gap between those two numbers is the multi-month
            effect: clients frequently settle several months in one transfer, which flatters cash in a given {unit} and
            leaves the following one looking quiet even when nothing has gone wrong.
          </p>
          <p>
            Holding churn at its current {r.churnRate}% of the roster, the expected lifetime value of a client works out
            to roughly <strong>{money(r.ltv)}</strong>. That figure is the single most useful ceiling when deciding how
            much effort or discount a new signing is worth: anything spent to win an account should stay comfortably
            below it, and anything spent to retain one is almost always cheaper than replacing it.
          </p>
          <p>
            Average tenure across the whole roster is {r.avgTenure} days. A rising tenure with flat churn means the base
            is maturing healthily; a rising tenure with rising churn means new signings are not sticking and the average
            is being propped up by a handful of long-standing accounts.
          </p>
        </Prose>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.topClients.slice(0, 10)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-20} height={50} textAnchor="end" stroke="var(--muted-foreground)" />
              <YAxis tickFormatter={(v: number) => shortMoney(v)} width={70} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => money(v)} {...tip} />
              <Legend verticalAlign="top" height={24} />
              <Bar name="Lifetime collected" dataKey="collected" fill="var(--leaf)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Page>

      {/* PAGE 7 */}
      <Page n={7} kicker="Concentration" title="Sector mix and dependency risk">
        <Prose>
          <p>
            The roster spans {r.sectorRows.length} sectors.{" "}
            {r.sectorRows[0]
              ? `${r.sectorRows[0].name} is the largest by recurring value at ${money(r.sectorRows[0].mrr)} across ${
                  r.sectorRows[0].clients
                } client${r.sectorRows[0].clients === 1 ? "" : "s"}.`
              : "No sector data has been recorded yet."}{" "}
            Sector spread matters because shocks tend to arrive by industry rather than by individual business — a bad
            season for one trade hits every client in it at the same time.
          </p>
          <p>
            The five largest accounts represent about <strong>{r.topFiveShare}%</strong> of monthly recurring revenue.
            Below roughly 30% the business is comfortably diversified; above 50% the loss of one or two relationships
            would materially change the monthly picture and justifies deliberate effort to widen the base.
          </p>
        </Prose>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.sectorRows.slice(0, 12)} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => shortMoney(v)} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => money(v)} {...tip} />
              <Legend verticalAlign="top" height={24} />
              <Bar name="Sector MRR" dataKey="mrr" fill="var(--leaf)" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Table
          head={
            <>
              <TH>Sector</TH>
              <TH>Clients</TH>
              <TH className="text-right">Monthly value</TH>
            </>
          }
        >
          {r.sectorRows.slice(0, 15).map((s) => (
            <tr key={s.name}>
              <TD className="font-medium">{s.name}</TD>
              <TD>{s.clients}</TD>
              <TD className="text-right font-medium text-primary">{money(s.mrr)}</TD>
            </tr>
          ))}
        </Table>
      </Page>

      {/* PAGE 8 */}
      <Page n={8} kicker="Momentum" title="Rolling performance over six periods">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={`Best ${unit}`} value={r.bestTrailing ? shortMoney(r.bestTrailing.revenue) : "—"} hint={r.bestTrailing?.label} tone="leaf" />
          <Stat label={`Weakest ${unit}`} value={r.worstTrailing ? shortMoney(r.worstTrailing.revenue) : "—"} hint={r.worstTrailing?.label} tone="mist" />
          <Stat label="Collection rate" value={`${r.collectionRate}%`} hint="Collected vs collectible" tone="deep" />
        </div>
        <Prose>
          <p>
            Reading six {unit}s at once removes the noise of a single strong or quiet stretch.{" "}
            {r.bestTrailing && r.worstTrailing
              ? `The strongest of the six was ${r.bestTrailing.label} at ${money(
                  r.bestTrailing.revenue,
                )}, the weakest ${r.worstTrailing.label} at ${money(r.worstTrailing.revenue)}.`
              : ""}{" "}
            The distance between those two is the volatility the business has to plan around; the closer they sit, the
            more confidently fixed costs can be committed.
          </p>
          <p>
            Against the money that could realistically have been collected this {unit} — recurring base plus overdue
            balances — the business captured <strong>{r.collectionRate}%</strong>. Cover of costs by collections stands
            at {r.runway.toFixed(2)}× ; anything under 1.0× means the period consumed reserves rather than adding to
            them.
          </p>
        </Prose>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={r.trailing} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickFormatter={(v: number) => shortMoney(v)} width={70} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => money(v)} {...tip} />
              <Legend verticalAlign="top" height={24} />
              <Line name="Collected" type="monotone" dataKey="revenue" stroke="var(--leaf)" strokeWidth={2.5} dot />
              <Line name="Spent" type="monotone" dataKey="spend" stroke="var(--leaf-deep)" strokeWidth={2} dot={false} />
              <Line name="Net" type="monotone" dataKey="net" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Page>

      {/* PAGE 9 */}
      <Page n={9} kicker="Delivery" title="App estate and service risk">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Live apps" value={String(r.appLive)} tone="leaf" />
          <Stat label="Suspended" value={String(r.appSuspended)} hint="Past grace, unpaid" tone="mist" />
          <Stat label="Closed" value={String(r.appClosed)} tone="deep" />
        </div>
        <Prose>
          <p>
            Of {clients.length} client apps, {r.appLive} are live, {r.appSuspended} are suspended for non-payment and{" "}
            {r.appClosed} have been closed. Suspension is never immediate: a client keeps full service through the{" "}
            {GRACE_DAYS}-day grace window while reminders go out every two days, and only an account that has crossed
            that line is eligible to be taken offline.
          </p>
          <p>
            Suspension is a collection tool, not a punishment — every suspended app is revenue that has already been
            earned and merely not yet received. The {r.pastGrace.length} account
            {r.pastGrace.length === 1 ? "" : "s"} currently past grace represent {money(r.owed)} of expected revenue,
            and restoring service the same day payment lands is what keeps that lever usable a second time.
          </p>
          <p>
            Conversion through the pipeline sits at {r.conversion}% signed against {r.lostRate}% lost. A healthy funnel
            loses prospects early and cheaply; losses late in the pipeline, after demos and negotiation, are the
            expensive kind and are worth reviewing case by case.
          </p>
        </Prose>
      </Page>

      {/* PAGE 10 */}
      <Page n={10} kicker="Outlook" title="Priorities for the next period">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Recurring base" value={shortMoney(r.mrr)} hint="Per month" tone="leaf" />
          <Stat label="Expected revenue" value={shortMoney(r.owed)} hint="Past grace" tone="mist" />
          <Stat label="Churn rate" value={`${r.churnRate}%`} tone="deep" />
          <Stat label="Pipeline" value={String(prospects.length)} hint={`${r.conversion}% conversion`} />
        </div>
        <Prose>
          <p>
            Taken together, this {unit} leaves the business with a recurring base of <strong>{money(r.mrr)}</strong>, a
            net result of <strong>{money(r.net)}</strong> and <strong>{money(r.owed)}</strong> sitting in overdue
            balances that has already been earned. The order of priority for the coming {unit} follows directly from
            those three figures.
          </p>
          <p>
            First, collection. The overdue balance is the cheapest revenue available — no selling, no delivery, only
            follow-up. Second, retention of the largest accounts, which carry roughly {r.topFiveShare}% of the monthly
            base between five relationships. Third, pipeline: {prospects.length} records with a {r.conversion}%
            conversion rate implies the next signings are already in the system and need working rather than replacing.
          </p>
          <p>
            Cost discipline stays the quiet lever.{" "}
            {r.categories.length > 0
              ? `${r.categories[0]!.name} remains the heaviest line at ${money(r.categories[0]!.value)} this ${unit}.`
              : "No expense concentration to flag this period."}{" "}
            With collections covering costs {r.runway.toFixed(2)}× over, a modest improvement on either side of that
            ratio compounds quickly across the six-{unit} view on the previous page.
          </p>
          <p>
            This report was generated from live records — payments, expenses, payouts, subscriptions, clients and the
            prospect pipeline — for {period.label.toLowerCase()}. Every figure recalculates when the underlying data
            changes, so it can be re-run and printed at the close of any {unit} without manual preparation.
          </p>
        </Prose>
      </Page>
    </>
  );
}
