import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  FolderGit2,
  KeyRound,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  Github,
  Cpu,
  Layers,
  ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Stat, Panel, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { fetchMergedClients, fetchMergedProjects } from "@/lib/pipeline-store";
import { fetchMergedProspects } from "@/lib/prospects-store";
import { extractProjectEnvironments } from "@/lib/project-environments";
import { fetchMergedAccounts } from "@/lib/lovable-accounts-store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lovable Solutions" },
      {
        name: "description",
        content: "Operations, client pipeline, projects and builder accounts.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchMergedProjects,
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: fetchMergedProspects,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: fetchMergedAccounts,
  });

  const { data: projectAccounts = [] } = useQuery({
    queryKey: ["all-project-accounts"],
    queryFn: async () =>
      (
        await supabase
          .from("project_accounts")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const activeProspects = prospects.filter((p) =>
    ["Contacted", "Demo", "Negotiating"].includes(p.stage),
  );
  const shippedProjects = projects.filter((p) => p.build_stage === "Shipped");
  const inProgressProjects = projects.filter(
    (p) => p.build_stage === "Building" || p.build_stage === "Testing",
  );

  return (
    <AppShell
      title="Operations Dashboard"
      subtitle="Complete bird's-eye view of agency clients, pipeline progression, active builds, and platform credentials."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/prospects"
            className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
          >
            <TrendingUp className="size-4" /> Go to Pipeline
          </Link>
          <Link
            to="/apps/emails"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-secondary"
          >
            <KeyRound className="size-4" /> Builder Accounts
          </Link>
        </div>
      }
    >
      {/* High-level stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Active Clients"
          value={String(clients.length)}
          hint="Signed & serviced organizations"
          tone="leaf"
          icon={<Users className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Active Builds"
          value={String(inProgressProjects.length)}
          hint={`${projects.length} total projects tracked`}
          tone="mist"
          icon={<FolderGit2 className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Active Leads"
          value={String(activeProspects.length)}
          hint={`${prospects.length} total in pipeline`}
          tone="deep"
          icon={<TrendingUp className="size-4 text-purple-600 dark:text-purple-400" />}
        />
        <Stat
          label="Builder Accounts"
          value={String(accounts.length)}
          hint="Google & platform login emails"
          tone="plain"
          icon={<KeyRound className="size-4 text-sky-600 dark:text-sky-400" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Projects Column */}
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Current Build Projects"
            right={
              <Link
                to="/apps/projects"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View all projects <ArrowRight className="size-3" />
              </Link>
            }
          >
            {projects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No projects found.</p>
            ) : (
              <div className="space-y-2.5">
                {projects.slice(0, 5).map((p) => {
                  const envs = extractProjectEnvironments(p, projectAccounts, accounts);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:border-border sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-display text-sm font-semibold text-foreground">
                            {p.project_name}
                          </p>
                          <Pill
                            tone={
                              p.build_stage === "Shipped"
                                ? "leaf"
                                : p.build_stage === "Building"
                                  ? "mist"
                                  : "plain"
                            }
                          >
                            {p.build_stage}
                          </Pill>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Client: {p.onboarded_by_name || "Internal"}
                        </p>

                        {/* Environments mini-badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground dark:bg-neutral-800"
                            title={`GitHub repo: ${envs.github.repo_url} (${envs.github.email})`}
                          >
                            <Github className="size-3" />
                            <span className="truncate max-w-[80px]">
                              {envs.github.repo_url.split("/").pop() || "repo"}
                            </span>
                          </span>

                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300"
                            title={`Google AI Studio: ${envs.googleAiStudio.email}`}
                          >
                            <Cpu className="size-3" />
                            <span className="truncate max-w-[90px]">
                              {envs.googleAiStudio.email.split("@")[0]}
                            </span>
                          </span>

                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            title={`Lovable: ${envs.lovable.email}`}
                          >
                            <Sparkles className="size-3" />
                            <span className="truncate max-w-[90px]">
                              {envs.lovable.email.split("@")[0]}
                            </span>
                            {envs.lovable.credits != null && (
                              <span className="font-bold">({envs.lovable.credits}cr)</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to="/apps/projects"
                          search={{ projectId: p.id }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <span>Manage</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Quick Operations Matrix */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/prospects"
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <TrendingUp className="size-4" />
                </span>
                <Pill tone="mist">{activeProspects.length} leads</Pill>
              </div>
              <div className="mt-3">
                <p className="font-semibold text-foreground">Sales Pipeline</p>
                <p className="text-xs text-muted-foreground">
                  Advance leads and convert to clients
                </p>
              </div>
            </Link>

            <Link
              to="/apps/projects"
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </span>
                <Pill tone="leaf">{shippedProjects.length} shipped</Pill>
              </div>
              <div className="mt-3">
                <p className="font-semibold text-foreground">Project Vaults</p>
                <p className="text-xs text-muted-foreground">
                  Manage credentials and connected tools
                </p>
              </div>
            </Link>

            <Link
              to="/apps/emails"
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <KeyRound className="size-4" />
                </span>
                <Pill tone="plain">{accounts.length} emails</Pill>
              </div>
              <div className="mt-3">
                <p className="font-semibold text-foreground">Builder Accounts</p>
                <p className="text-xs text-muted-foreground">Google logins, credits & passwords</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Sidebar: Pipeline Highlights */}
        <div className="space-y-4">
          <Panel
            title="Recent Pipeline Leads"
            right={
              <Link to="/prospects" className="text-xs font-semibold text-primary hover:underline">
                View CRM
              </Link>
            }
          >
            {prospects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No leads recorded.</p>
            ) : (
              <div className="space-y-3">
                {prospects.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{p.business_name}</span>
                      <Pill tone={p.stage === "Signed" ? "leaf" : "mist"}>{p.stage}</Pill>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.industry || "General"} · {p.contact_name || "No contact"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
