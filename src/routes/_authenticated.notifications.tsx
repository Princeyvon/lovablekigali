import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, Stat } from "@/components/dash";
import { FilterSelect, SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { GRACE_DAYS, dueState, fmtDate, money, paidThrough } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Lovable Solutions" },
      { name: "description", content: "Every overdue client, grace-period warning and shutdown-eligible app in one feed." },
      { property: "og:title", content: "Notifications — Lovable Solutions" },
      { property: "og:description", content: "One feed for everything that needs attention today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });

  const rows = useMemo(
    () =>
      clients
        .map((c) => {
          const through = paidThrough(payments.filter((p) => p.client_id === c.id));
          const state = dueState(through ?? c.signed_date, null);
          const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
          return { id: c.id, name: c.business_name, industry: c.industry, rate, ...state };
        })
        .filter((r) => r.overdue)
        .sort((a, b) => b.daysOverdue - a.daysOverdue),
    [clients, payments, subs],
  );

  const visible = rows.filter(
    (r) =>
      (sev === "all" || (sev === "past-grace" ? r.suspendable : !r.suspendable)) &&
      matches(q, r.name, r.industry as string | null),
  );
  const atRisk = rows.filter((r) => r.suspendable);

  return (
    <AppShell
      title="Notifications"
      subtitle={`Overdue clients and apps eligible for shutdown after ${GRACE_DAYS} days.`}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search clients…" />
          <FilterSelect
            label="Severity"
            value={sev}
            onChange={setSev}
            options={[
              { value: "grace", label: "In grace" },
              { value: "past-grace", label: "Past grace" },
            ]}
          />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Overdue clients" value={String(rows.length)} tone="mist" />
        <Stat label="Past grace" value={String(atRisk.length)} hint="Can be switched off" tone="deep" />
        <Stat label="Revenue at risk" value={money(rows.reduce((s, r) => s + r.rate, 0))} tone="leaf" />
        <Stat
          label="Worst delay"
          value={`${rows[0]?.daysOverdue ?? 0} d`}
          hint={rows[0]?.name ?? "All current"}
          tone="sky"
        />
      </div>

      <Panel title={`${visible.length} alerts`}>
        {visible.length === 0 ? (
          <Empty>Nothing needs you right now.</Empty>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((r) => (
              <Link
                key={r.id}
                to="/clients/$id"
                params={{ id: r.id }}
                className="flex items-start gap-3 py-3 transition hover:bg-secondary/50"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="numeric mt-0.5 text-xs text-muted-foreground">
                    {r.daysOverdue} day{r.daysOverdue === 1 ? "" : "s"} overdue · due {fmtDate(r.through)} ·{" "}
                    {money(r.rate)}/mo
                  </p>
                </div>
                <Pill tone={r.suspendable ? "warn" : "mist"}>{r.suspendable ? "Past grace" : "In grace"}</Pill>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
