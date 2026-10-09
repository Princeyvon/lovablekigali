import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Users,
  DollarSign,
  Award,
  Target,
  Activity,
  Share2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { FINANCE_TABS } from "@/routes/_authenticated.finance";
import { Stat, Panel, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money } from "@/lib/agency";
import { fetchMergedClients, fetchMergedProjects } from "@/lib/pipeline-store";
import { fetchMergedProspects } from "@/lib/prospects-store";

export const Route = createFileRoute("/_authenticated/finance/insights")({
  head: () => ({
    meta: [
      { title: "Velocity & Financial Insights — Lovable Solutions" },
      {
        name: "description",
        content: "Weekly deal velocity, revenue collection, rep attribution and churn health.",
      },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: fetchMergedProspects,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("*")).data ?? [],
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => (await supabase.from("commissions").select("*")).data ?? [],
  });

  const totalRevenue = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalCost = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netOperatingProfit = totalRevenue - totalCost;
  const signedDeals = prospects.filter((p) => p.stage === "Signed");
  const winRate =
    prospects.length > 0 ? Math.round((signedDeals.length / prospects.length) * 100) : 0;

  // Referral breakdown
  const referralSigned = signedDeals.filter((p) => p.source === "Referral").length;
  const inboundSigned = signedDeals.filter(
    (p) => p.source === "Inbound Website" || p.source === "LinkedIn",
  ).length;

  return (
    <AppShell
      title="Financial Velocity & Health"
      subtitle="Agency operating metrics: deal velocity, revenue collection vs expenses, and rep attribution."
    >
      <SubTabs tabs={FINANCE_TABS} />

      {/* Top Stat Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Collected"
          value={money(totalRevenue)}
          hint="From client retainers & payments"
          tone="leaf"
          icon={<DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Operating Profit"
          value={money(netOperatingProfit)}
          hint="Net revenue minus agency expenses"
          tone={netOperatingProfit >= 0 ? "leaf" : "warn"}
          icon={<TrendingUp className="size-4 text-purple-600 dark:text-purple-400" />}
        />
        <Stat
          label="Pipeline Win Rate"
          value={`${winRate}%`}
          hint={`${signedDeals.length} won from ${prospects.length} total leads`}
          tone="mist"
          icon={<Target className="size-4 text-blue-600 dark:text-blue-400" />}
        />
        <Stat
          label="Active Clients"
          value={String(clients.filter((c) => c.status === "Active").length)}
          hint={`${clients.length} total contracted businesses`}
          tone="deep"
          icon={<Users className="size-4 text-amber-600 dark:text-amber-400" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deal Conversion Yield */}
        <Panel title="Acquisition Channels Yield">
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Share2 className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm">Referral Network</p>
                  <p className="text-xs text-muted-foreground">
                    Word of mouth & client introductions
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-foreground">{referralSigned} signed</p>
                <p className="text-[11px] text-muted-foreground">High conversion rate</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Activity className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm">Inbound & Digital</p>
                  <p className="text-xs text-muted-foreground">
                    Direct site inquiries and LinkedIn
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-foreground">{inboundSigned} signed</p>
                <p className="text-[11px] text-muted-foreground">Organic flow</p>
              </div>
            </div>
          </div>
        </Panel>

        {/* Rep Attribution */}
        <Panel title="Sales Rep Attribution">
          <div className="space-y-3 pt-1">
            {members.map((m) => {
              const repProspects = prospects.filter((p) => p.assigned_rep === m.id);
              const repSigned = repProspects.filter((p) => p.stage === "Signed").length;
              const repComms = commissions.filter((c) => c.rep_id === m.id);
              const commPaid = repComms.reduce((acc, c) => acc + Number(c.amount || 0), 0);

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                      {m.full_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {repProspects.length} assigned deals
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {repSigned} closed
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {money(commPaid)} commission
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
