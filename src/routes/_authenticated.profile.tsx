import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { UserCog, Hammer, Wallet, UserSquare2, CircleCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Empty, Stat } from "@/components/dash";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Lovable Solutions" },
      {
        name: "description",
        content: "Your account, activity, sales, builds and payouts.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role, memberId } = useAuth();

  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => (await supabase.from("prospects").select("*")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("*")).data ?? [],
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ["team_payouts"],
    queryFn: async () => (await supabase.from("team_payouts").select("*")).data ?? [],
  });

  const email = user?.email ?? "";
  const myProspects = useMemo(
    () => prospects.filter((p) => p.assigned_rep === email || p.assigned_rep === memberId),
    [prospects, email, memberId],
  );
  const myClients = useMemo(
    () => clients.filter((c) => c.onboarded_by === email || c.onboarded_by === memberId),
    [clients, email, memberId],
  );
  const myBuilds = useMemo(
    () => projects.filter((p) => p.built_by === email || p.built_by === memberId),
    [projects, email, memberId],
  );
  const myPayouts = useMemo(
    () => payouts.filter((p) => p.team_member_id === memberId),
    [payouts, memberId],
  );
  const payoutTotal = myPayouts.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <AppShell title="My Profile" subtitle="Your account and everything you've touched.">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <span className="gradient-leaf flex size-14 items-center justify-center rounded-2xl text-lg font-bold text-primary-foreground">
            {email.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{email.split("@")[0]}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <Pill tone="leaf">{role} access</Pill>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Prospects handled" value={String(myProspects.length)} />
        <Stat label="Clients onboarded" value={String(myClients.length)} />
        <Stat label="Projects built" value={String(myBuilds.length)} />
        <Stat label="Payouts received" value={money(payoutTotal)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="My builds" right={<Hammer className="size-4 text-muted-foreground" />}>
          {!myBuilds.length ? (
            <Empty icon={Hammer} text="No projects attributed to you yet." />
          ) : (
            <ul className="divide-y divide-border">
              {myBuilds.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    to="/apps/projects"
                    search={{ projectId: p.id }}
                    className="min-w-0 flex-1 truncate font-medium hover:opacity-80"
                  >
                    {p.project_name}
                  </Link>
                  <Pill tone={p.build_stage === "Shipped" ? "leaf" : "mist"}>{p.build_stage}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="My sales" right={<UserSquare2 className="size-4 text-muted-foreground" />}>
          {!myClients.length && !myProspects.length ? (
            <Empty icon={UserSquare2} text="No sales activity yet." />
          ) : (
            <ul className="divide-y divide-border">
              {myClients.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="min-w-0 flex-1 truncate font-medium hover:opacity-80"
                  >
                    {c.business_name}
                  </Link>
                  <Pill tone="leaf">Client</Pill>
                </li>
              ))}
              {myProspects.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.business_name}</span>
                  <Pill tone="mist">{p.stage}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="My payouts" right={<Wallet className="size-4 text-muted-foreground" />}>
          {!myPayouts.length ? (
            <Empty icon={CircleCheck} text="No payouts recorded yet." />
          ) : (
            <ul className="divide-y divide-border">
              {myPayouts.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {fmtDate(p.date_sent)} · {p.type}
                  </span>
                  <span className="numeric font-medium">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">
        Signed in as {email} with {role} permissions. Activity is matched by your email and team
        member record.
      </p>
    </AppShell>
  );
}
