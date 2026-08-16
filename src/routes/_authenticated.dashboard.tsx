import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Donut, Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { REMINDER_WINDOW_DAYS, ROTATION_STALE_DAYS, daysUntil, fmtDate, money, paidThrough, shortMoney, startOfWeek } from "@/lib/agency";

function Trend({ current, previous, unit = "" }: { current: number; previous: number; unit?: string }) {
  const delta = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {Math.round(delta)}% {unit}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lovable Solutions" },
      { name: "description", content: "Payments due, overdue accounts, weekly velocity and credential rotation alerts." },
      { property: "og:title", content: "Dashboard — Lovable Solutions" },
      { property: "og:description", content: "The daily operating view of the agency." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [clients, payments, subs, creds, prospects] = await Promise.all([
        supabase.from("clients").select("id, business_name, status, signed_date"),
        supabase.from("payments").select("client_id, amount, payment_date, covers_period_end, months_covered"),
        supabase.from("subscriptions").select("client_id, monthly_rate, status"),
        supabase.from("client_credentials").select("id, service_name, client_id, last_rotated"),
        supabase.from("prospects").select("id, stage, created_at"),
      ]);
      return {
        clients: clients.data ?? [],
        payments: payments.data ?? [],
        subs: subs.data ?? [],
        creds: creds.data ?? [],
        prospects: prospects.data ?? [],
      };
    },
  });

  const clients = data?.clients ?? [];
  const payments = data?.payments ?? [];

  const byClient = clients.map((c) => {
    const paid = payments.filter((p) => p.client_id === c.id);
    const through = paidThrough(paid);
    return { ...c, paidThrough: through, days: daysUntil(through) };
  });

  const dueSoon = byClient.filter((c) => c.days !== null && c.days >= 0 && c.days <= REMINDER_WINDOW_DAYS);
  const overdue = byClient.filter((c) => c.days !== null && c.days < 0);
  const mrr = (data?.subs ?? []).filter((s) => s.status === "Active").reduce((a, s) => a + Number(s.monthly_rate), 0);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - (7 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const revenue = payments
      .filter((p) => new Date(p.payment_date) >= start && new Date(p.payment_date) < end)
      .reduce((a, p) => a + Number(p.amount), 0);
    const leads = (data?.prospects ?? []).filter(
      (p) => new Date(p.created_at) >= start && new Date(p.created_at) < end,
    ).length;
    return {
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      revenue,
      leads,
    };
  });

  const thisWeek = weeks[weeks.length - 1] ?? { revenue: 0, leads: 0 };
  const lastWeek = weeks[weeks.length - 2] ?? { revenue: 0, leads: 0 };

  const staleCreds = (data?.creds ?? []).filter((c) => {
    const d = daysUntil(c.last_rotated);
    return d !== null && Math.abs(d) > ROTATION_STALE_DAYS;
  });

  const active = clients.filter((c) => c.status === "Active").length;

  return (
    <AppShell title="Dashboard" subtitle="Everything that needs your attention this week.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly recurring" value={money(mrr)} hint={`${active} active clients`} icon={<Wallet className="size-4" />} />
        <Stat label="Due within 5 days" value={String(dueSoon.length)} hint="Reminders queued" tone="mist" />
        <Stat label="Overdue accounts" value={String(overdue.length)} hint="Past paid-through date" tone="deep" />
        <Stat
          label="Rotation alerts"
          value={String(staleCreds.length)}
          hint="Credentials older than 12 months"
          icon={<KeyRound className="size-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel
            title="Revenue collected per week"
            right={
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold">{money(thisWeek.revenue)} this week</span>
                <Trend current={thisWeek.revenue} previous={lastWeek.revenue} unit="vs last week" />
              </div>
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--leaf)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--leaf)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis
                    tickFormatter={(v: number) => shortMoney(v)}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    fontSize={12}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    formatter={(v: number) => [money(v), "Revenue"]}
                    labelFormatter={(l: string) => `Week of ${l}`}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Legend verticalAlign="top" height={24} />
                  <Area
                    name="Revenue (RWF)"
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--leaf)"
                    strokeWidth={2.5}
                    fill="url(#revFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="New prospects per week"
            right={
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold">{thisWeek.leads} this week</span>
                <Trend current={thisWeek.leads} previous={lastWeek.leads} unit="vs last week" />
              </div>
            }
          >
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip
                    labelFormatter={(l: string) => `Week of ${l}`}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Legend verticalAlign="top" height={24} />
                  <Bar name="New prospects" dataKey="leads" fill="var(--leaf-deep)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>


        <Panel title="Collection health">
          <Donut
            value={clients.length - overdue.length}
            total={Math.max(clients.length, 1)}
            caption="paid through"
          />
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
              <span className="text-secondary-foreground">Collected all-time</span>
              <span className="font-semibold">{money(payments.reduce((a, p) => a + Number(p.amount), 0))}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Payments logged</span>
              <span className="font-semibold">{payments.length}</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Billing attention"
        right={
          <Link to="/billing" className="text-xs font-semibold text-primary hover:underline">
            Open billing
          </Link>
        }
      >
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : [...overdue, ...dueSoon].length === 0 ? (
          <Empty>Nothing due — every client is paid through.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Client</TH>
                <TH>Paid through</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </>
            }
          >
            {[...overdue, ...dueSoon].map((c) => (
              <tr key={c.id}>
                <TD className="font-medium">{c.business_name}</TD>
                <TD>{fmtDate(c.paidThrough)}</TD>
                <TD>
                  {c.days! < 0 ? (
                    <Pill tone="warn">
                      <AlertTriangle className="mr-1 size-3" /> {Math.abs(c.days!)}d overdue
                    </Pill>
                  ) : (
                    <Pill tone="leaf">due in {c.days}d</Pill>
                  )}
                </TD>
                <TD className="text-right">
                  <Link to="/clients/$id" params={{ id: c.id }} className="text-xs font-semibold text-primary hover:underline">
                    View client
                  </Link>
                </TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Credential rotation alerts" right={<TrendingUp className="size-4 text-muted-foreground" />}>
        {staleCreds.length === 0 ? (
          <Empty>All credentials rotated within the last 12 months.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Service</TH>
                <TH>Client</TH>
                <TH>Last rotated</TH>
              </>
            }
          >
            {staleCreds.map((c) => (
              <tr key={c.id}>
                <TD className="font-medium">{c.service_name}</TD>
                <TD>{clients.find((cl) => cl.id === c.client_id)?.business_name ?? "—"}</TD>
                <TD>{fmtDate(c.last_rotated)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
