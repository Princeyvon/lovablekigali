import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bell, ShieldAlert, CircleCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Empty } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { dueState, paidThrough } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Lovable Solutions" },
      {
        name: "description",
        content: "All overdue invoices, suspension warnings and account alerts in one place.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  const alerts = useMemo(
    () =>
      clients
        .map((c) => {
          const through = paidThrough(payments.filter((p) => p.client_id === c.id));
          const state = dueState(through ?? c.signed_date, null);
          return { id: c.id, name: c.business_name, status: c.status, ...state };
        })
        .filter((r) => r.overdue)
        .sort((a, b) => b.daysOverdue - a.daysOverdue),
    [clients, payments],
  );

  const pastGrace = alerts.filter((a) => a.suspendable);
  const inGrace = alerts.filter((a) => !a.suspendable);

  return (
    <AppShell
      title="Notifications"
      subtitle="Every alert across billing, suspensions and account health."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Past grace period" right={<Pill tone="warn">{pastGrace.length}</Pill>}>
          {!pastGrace.length ? (
            <Empty icon={CircleCheck} text="No clients past the 14-day grace period." />
          ) : (
            <ul className="divide-y divide-border">
              {pastGrace.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: a.id }}
                    className="flex items-center gap-3 py-2.5 text-sm hover:opacity-80"
                  >
                    <ShieldAlert className="size-4 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className="numeric text-xs text-muted-foreground">
                      {a.daysOverdue} days overdue
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Overdue, in grace" right={<Pill tone="mist">{inGrace.length}</Pill>}>
          {!inGrace.length ? (
            <Empty icon={CircleCheck} text="No clients in the grace window." />
          ) : (
            <ul className="divide-y divide-border">
              {inGrace.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: a.id }}
                    className="flex items-center gap-3 py-2.5 text-sm hover:opacity-80"
                  >
                    <Bell className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className="numeric text-xs text-muted-foreground">
                      {a.daysOverdue} days overdue
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {!alerts.length ? (
        <Panel>
          <Empty icon={CircleCheck} text="All clients are current. Nothing needs attention." />
        </Panel>
      ) : null}
    </AppShell>
  );
}
