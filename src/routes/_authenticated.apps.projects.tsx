import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  KeyRound,
  Layers,
  Mail,
  Github,
  Cpu,
  Sparkles,
  Plus,
  X,
  ExternalLink,
  ShieldCheck,
  BookMarked,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { Empty, Panel, Pill, Stat } from "@/components/dash";
import { FilterSelect, SearchInput, matches } from "@/components/search";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, todayISO } from "@/lib/agency";
import { ProjectAccounts } from "@/components/ProjectAccounts";
import { ProjectEnvironmentsHub } from "@/components/ProjectEnvironmentsHub";
import { extractProjectEnvironments, saveProjectEnvironments } from "@/lib/project-environments";
import {
  fetchMergedClients,
  fetchMergedProjects,
  upsertLocalProject,
  PipelineProject,
  PRINCE_MEMBER_ID,
  PRINCE_MEMBER_NAME,
} from "@/lib/pipeline-store";
import { fetchMergedProspects } from "@/lib/prospects-store";
import { fetchMergedAccounts } from "@/lib/lovable-accounts-store";
import { persistWorkflowChange, broadcastDbSync } from "@/lib/database-interconnect";
import { EmailPasswordModal } from "@/components/EmailPasswordModal";

export const BUILD_STAGES = ["Planning", "Building", "Testing", "Shipped"] as const;
export const PAYMENT_STATES = ["Unpaid", "Deposit", "Awaiting payment", "Paid"] as const;

export const Route = createFileRoute("/_authenticated/apps/projects")({
  validateSearch: (search: Record<string, unknown>): { projectId?: string; tab?: string } => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Projects — Lovable Solutions" },
      {
        name: "description",
        content:
          "Pick a project and see the client, the hosting email account and the build stage.",
      },
      { property: "og:title", content: "Projects — Lovable Solutions" },
      {
        property: "og:description",
        content: "Every build, its owner, its account and its payment state.",
      },
    ],
  }),
  component: Projects,
});

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Projects() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [picked, setPicked] = useState<string | null>(search.projectId ?? null);
  const [projectSubTab, setProjectSubTab] = useState<
    "Environments" | "Credentials" | "Overview" | "History"
  >(() => {
    if (search.tab === "Credentials") return "Credentials";
    if (search.tab === "Overview") return "Overview";
    if (search.tab === "History") return "History";
    return "Environments";
  });

  useEffect(() => {
    if (search.projectId) {
      setPicked(search.projectId);
    }
    if (search.tab) {
      if (
        search.tab === "Environments" ||
        search.tab === "Credentials" ||
        search.tab === "Overview" ||
        search.tab === "History"
      ) {
        setProjectSubTab(search.tab);
      }
    }
  }, [search.projectId, search.tab]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchMergedProjects,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
  });
  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects"],
    queryFn: fetchMergedProspects,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: fetchMergedAccounts,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("id, full_name")).data ?? [],
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ["project-transfers"],
    queryFn: async () =>
      (await supabase.from("project_transfers").select("*").order("moved_at", { ascending: false }))
        .data ?? [],
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

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    projectName: "",
    clientId: "",
    stage: "Planning" as (typeof BUILD_STAGES)[number],
    githubUrl: "",
    githubEmail: "dev@lovablesolutions.com",
    aiStudioEmail: "",
    lovableEmail: "",
  });

  const [pwdModalEmail, setPwdModalEmail] = useState<{
    open: boolean;
    email: string;
    label?: string;
  }>({
    open: false,
    email: "",
    label: "",
  });

  const clientOf = (id: string | null) => clients.find((c) => c.id === id);
  const accountOf = (id: string | null) => accounts.find((a) => a.id === id);

  const createProjectWithEnvs = useMutation({
    mutationFn: async () => {
      if (!newProjectForm.projectName.trim()) {
        throw new Error("Project name is required");
      }
      const now = new Date().toISOString();
      const newId = crypto.randomUUID();
      const slug = newProjectForm.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const targetLovableAcc = accounts.find((a) => a.email === newProjectForm.lovableEmail);
      const targetAiAcc = accounts.find((a) => a.email === newProjectForm.aiStudioEmail);

      const newProj: PipelineProject = {
        id: newId,
        project_name: newProjectForm.projectName.trim(),
        client_id:
          newProjectForm.clientId || clients[0]?.id || "c1000000-0000-4000-8000-000000000001",
        hosting_account_id: targetLovableAcc?.id || accounts[0]?.id || null,
        built_by: PRINCE_MEMBER_ID,
        build_stage: newProjectForm.stage,
        app_url: `https://${slug}.lovable.app`,
        started_at: todayISO(),
        shipped_at: newProjectForm.stage === "Shipped" ? todayISO() : null,
        due_at: null,
        notes: `Created with GitHub, Google AI Studio, and Lovable environments`,
        payment_state: "Awaiting payment",
        created_at: now,
        updated_at: now,
        prospect_id: null,
        onboarded_by_name: PRINCE_MEMBER_NAME,
        github_repo_url:
          newProjectForm.githubUrl.trim() || `https://github.com/lovable-solutions/${slug}`,
        github_email: newProjectForm.githubEmail.trim() || "dev@lovablesolutions.com",
        google_ai_studio_email:
          newProjectForm.aiStudioEmail.trim() ||
          accounts[0]?.email ||
          "ai-builder@lovablesolutions.com",
        google_ai_studio_url: "https://aistudio.google.com",
        lovable_email:
          newProjectForm.lovableEmail.trim() || accounts[0]?.email || "princeyvon30@gmail.com",
        lovable_url: `https://lovable.dev/projects/${newId}`,
      };

      upsertLocalProject(newProj);

      {
        const { error: insErr } = await supabase.from("projects").insert({
          id: newId,
          project_name: newProj.project_name,
          client_id: newProj.client_id,
          hosting_account_id: newProj.hosting_account_id,
          built_by: PRINCE_MEMBER_ID,
          build_stage: newProj.build_stage,
          app_url: newProj.app_url,
          started_at: todayISO(),
          payment_state: "Awaiting payment",
        });
        if (insErr) throw new Error(insErr.message);
      }

      await saveProjectEnvironments({
        projectId: newId,
        github: {
          repo_url: newProj.github_repo_url!,
          email: newProj.github_email!,
        },
        googleAiStudio: {
          email: newProj.google_ai_studio_email!,
          url: "https://aistudio.google.com",
          account_id: targetAiAcc?.id,
        },
        lovable: {
          email: newProj.lovable_email!,
          url: newProj.lovable_url || undefined,
          account_id: targetLovableAcc?.id,
        },
      });

      return newProj;
    },
    onSuccess: (newProj) => {
      toast.success(`Project "${newProj.project_name}" created with all 3 environments!`);
      setIsNewProjectOpen(false);
      setPicked(newProj.id);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          (stage === "all" || p.build_stage === stage) &&
          matches(
            q,
            p.project_name,
            p.app_url,
            clientOf(p.client_id)?.business_name ?? null,
            p.payment_state,
          ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, q, stage, clients],
  );

  const current = projects.find((p) => p.id === (picked ?? visible[0]?.id)) ?? null;
  const account = current ? accountOf(current.hosting_account_id) : undefined;
  const client = current ? clientOf(current.client_id) : undefined;
  const prospect = current ? prospects.find((x) => x.id === current.prospect_id) : undefined;

  const update = useMutation({
    mutationFn: async (patch: Partial<(typeof projects)[number]>) => {
      if (!current) return;
      await persistWorkflowChange({
        projectId: current.id,
        stage: patch.build_stage as (typeof BUILD_STAGES)[number] | undefined,
        hostingAccountId: patch.hosting_account_id,
        appUrl: patch.app_url,
        notes: patch.notes,
        projectName: patch.project_name,
        paymentState: patch.payment_state,
        clientId: current.client_id,
      });
    },
    onSuccess: () => {
      toast.success("Project updated");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveAccount = useMutation({
    mutationFn: async (to: string) => {
      if (!current) return;
      const from = current.hosting_account_id ?? null;
      const upd = await supabase
        .from("projects")
        .update({ hosting_account_id: to })
        .eq("id", current.id);
      if (upd.error) throw new Error(upd.error.message);
      if (current.client_id) {
        await supabase
          .from("clients")
          .update({ hosting_account_id: to })
          .eq("id", current.client_id);
      }
      const log = await supabase.from("project_transfers").insert({
        client_id: current.client_id,
        from_account_id: from,
        to_account_id: to,
        note: `Moved from the Projects view (${current.project_name})`,
      });
      if (log.error) throw new Error(log.error.message);
    },
    onSuccess: () => {
      toast.success("Project moved to the new account");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["project-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const history = current ? transfers.filter((t) => t.client_id === current.client_id) : [];

  const currentCredentialsCount = useMemo(() => {
    if (!current) return 0;
    return projectAccounts.filter((pa) => pa.project_id === current.id).length;
  }, [projectAccounts, current]);

  return (
    <AppShell
      title="Projects & Platforms"
      subtitle="Inspect active software builds, connected platform environments (GitHub, Google AI Studio, Lovable), and secure credential vaults."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/apps/emails"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Platform Matrix</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setNewProjectForm({
                projectName: "",
                clientId: clients[0]?.id || "",
                stage: "Planning",
                githubUrl: "",
                githubEmail: "dev@lovablesolutions.com",
                aiStudioEmail: accounts[0]?.email || "ai-builder@lovablesolutions.com",
                lovableEmail: accounts[0]?.email || "princeyvon30@gmail.com",
              });
              setIsNewProjectOpen(true);
            }}
            className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition cursor-pointer"
          >
            <Plus className="size-4" /> Start Project
          </button>
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Total Builds" value={String(projects.length)} tone="leaf" />
        <Stat
          label="In Build Pipeline"
          value={String(projects.filter((p) => p.build_stage !== "Shipped").length)}
          tone="mist"
        />
        <Stat
          label="Shipped Builds"
          value={String(projects.filter((p) => p.build_stage === "Shipped").length)}
          tone="deep"
        />
        <Stat
          label="Hosting Coverage"
          value={`${projects.length ? Math.round((projects.filter((p) => Boolean(p.hosting_account_id)).length / projects.length) * 100) : 100}%`}
          hint={`${projects.filter((p) => !p.hosting_account_id).length} unassigned`}
          tone="mist"
        />
      </div>

      {/* Main Two-Column Directory & Workspace */}
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        {/* Left Column: Projects Directory Sidebar */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col h-[calc(100vh-14rem)] min-h-[560px] sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">Projects Directory</h3>
              <p className="text-[11px] text-muted-foreground">Select a project to inspect</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {visible.length} {visible.length === 1 ? "project" : "projects"}
            </span>
          </div>

          {/* Quick Search & Stage Filter */}
          <div className="py-3 space-y-2 border-b border-border/60">
            <SearchInput value={q} onChange={setQ} placeholder="Filter projects, clients, tech…" />
            <FilterSelect
              label="Stage"
              value={stage}
              onChange={setStage}
              options={BUILD_STAGES.map((s) => ({ value: s, label: s }))}
              allLabel="All Stages"
              className="w-full"
            />
          </div>

          {/* Projects List */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-2 pr-1">
            {visible.length === 0 ? (
              <Empty>No project matches your filters.</Empty>
            ) : (
              visible.map((p) => {
                const active = current?.id === p.id;
                const envs = extractProjectEnvironments(p, projectAccounts, accounts);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(p.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition cursor-pointer group space-y-2",
                      active
                        ? "border-primary/80 bg-primary/10 shadow-xs ring-1 ring-primary/25"
                        : "border-border/70 bg-card hover:bg-secondary/60 hover:border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-semibold transition",
                            active ? "text-primary" : "text-foreground group-hover:text-primary",
                          )}
                        >
                          {p.project_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground mt-0.5">
                          {clientOf(p.client_id)?.business_name ?? "Internal project"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          p.build_stage === "Shipped"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : p.build_stage === "Building"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {p.build_stage}
                      </span>
                    </div>

                    {/* Environment Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40 text-[10px]">
                      <span
                        className="inline-flex items-center gap-1 rounded bg-secondary/80 px-1.5 py-0.5 font-medium text-foreground"
                        title={`GitHub: ${envs.github.repo_url || "Not set"}`}
                      >
                        <Github className="size-2.5 text-muted-foreground" />
                        <span className="truncate max-w-[80px]">
                          {envs.github.repo_url.split("/").pop() || "repo"}
                        </span>
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 dark:text-sky-300"
                        title={`Google AI Studio: ${envs.googleAiStudio.email}`}
                      >
                        <Cpu className="size-2.5 text-sky-600 dark:text-sky-400" />
                        <span className="truncate max-w-[70px]">
                          {envs.googleAiStudio.email.split("@")[0] || "AI Studio"}
                        </span>
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
                        title={`Lovable: ${envs.lovable.email}`}
                      >
                        <Sparkles className="size-2.5 text-primary" />
                        <span className="truncate max-w-[70px]">
                          {envs.lovable.email.split("@")[0] || "Lovable"}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Project Workspace */}
        {current ? (
          <div className="space-y-5 min-w-0">
            {/* Quick Mobile Project Selector */}
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs lg:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Active Project
                  </p>
                  <select
                    value={current.id}
                    onChange={(e) => setPicked(e.target.value)}
                    className="w-full truncate bg-transparent font-display text-sm font-bold text-foreground outline-none cursor-pointer"
                  >
                    {visible.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        className="bg-popover text-popover-foreground"
                      >
                        {p.project_name} ({p.build_stage})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {visible.length}
              </span>
            </div>

            {/* Project Header Bar with SubTabs */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                      {current.project_name}
                    </h2>
                    <Pill
                      tone={
                        current.build_stage === "Shipped"
                          ? "leaf"
                          : current.build_stage === "Building"
                            ? "warn"
                            : "mist"
                      }
                    >
                      {current.build_stage}
                    </Pill>
                    <span className="rounded-md border border-border/70 bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {current.payment_state}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Client:{" "}
                      {client ? (
                        <Link
                          to="/clients/$id"
                          params={{ id: client.id }}
                          className="font-medium text-foreground hover:text-primary transition hover:underline"
                        >
                          {client.business_name}
                        </Link>
                      ) : (
                        <span className="italic">Internal</span>
                      )}
                    </span>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="size-3 text-muted-foreground" />
                      <span>{account?.email ?? "No hosting account"}</span>
                    </span>
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                    <span>
                      Timeline: {fmtDate(current.started_at)} → {fmtDate(current.due_at)}
                    </span>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {current.app_url && (
                    <a
                      href={current.app_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary hover:border-primary/40"
                    >
                      <ExternalLink className="size-3.5 text-primary" />
                      <span>Open Live App</span>
                    </a>
                  )}

                  <Link
                    to="/library/skills"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary hover:border-primary/40"
                    title="Browse System Skills & Architecture Specs"
                  >
                    <BookMarked className="size-3.5 text-primary" />
                    <span className="hidden md:inline">Library SOPs</span>
                  </Link>
                </div>
              </div>

              {/* Segmented SubTab switcher */}
              <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl border border-border bg-secondary/50 p-1.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setProjectSubTab("Environments")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer",
                    projectSubTab === "Environments"
                      ? "gradient-leaf text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <Layers className="size-3.5" />
                  <span>Environments & Platforms</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      projectSubTab === "Environments"
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    3
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectSubTab("Credentials")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer",
                    projectSubTab === "Credentials"
                      ? "gradient-leaf text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <KeyRound className="size-3.5" />
                  <span>Credentials Vault</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      projectSubTab === "Credentials"
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {currentCredentialsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectSubTab("Overview")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer",
                    projectSubTab === "Overview"
                      ? "gradient-leaf text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <Cpu className="size-3.5" />
                  <span>Project Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProjectSubTab("History")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer",
                    projectSubTab === "History"
                      ? "gradient-leaf text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <ArrowRightLeft className="size-3.5" />
                  <span>Account History</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      projectSubTab === "History"
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {history.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Environments SubTab */}
            {projectSubTab === "Environments" && <ProjectEnvironmentsHub project={current} />}

            {/* Credentials Vault SubTab */}
            {projectSubTab === "Credentials" && <ProjectAccounts projectId={current.id} />}

            {/* Project Details SubTab */}
            {projectSubTab === "Overview" && (
              <Panel
                title="Project Details"
                right={
                  <Pill tone={current.build_stage === "Shipped" ? "leaf" : "mist"}>
                    {current.build_stage}
                  </Pill>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Hosted on
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="truncate">{account?.email ?? "Not assigned"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {account
                        ? `${Number(account.credits_remaining ?? 0).toLocaleString("en-US")} credits left${account.label ? ` · ${account.label}` : ""}`
                        : "Pick an account below"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Client
                    </p>
                    {client ? (
                      <Link
                        to="/clients/$id"
                        params={{ id: client.id }}
                        className="mt-1 block truncate text-sm font-medium text-primary hover:underline"
                      >
                        {client.business_name}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm">—</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {prospect ? `From prospect · ${prospect.stage}` : "Direct client"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Timeline
                    </p>
                    <p className="mt-1 text-sm">
                      Started {fmtDate(current.started_at)} · Due {fmtDate(current.due_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {current.shipped_at
                        ? `Shipped ${fmtDate(current.shipped_at)}`
                        : "Not shipped yet"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Built by
                    </p>
                    <p className="mt-1 text-sm">
                      {members.find((m) => m.id === current.built_by)?.full_name ?? "Unassigned"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{current.payment_state}</p>
                  </div>
                </div>

                {current.app_url ? (
                  <a
                    href={current.app_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-primary hover:underline"
                  >
                    {current.app_url}
                  </a>
                ) : null}
                {current.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {current.notes}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Build stage
                    <select
                      className={field + " mt-1"}
                      value={current.build_stage}
                      onChange={(e) =>
                        update.mutate({
                          build_stage: e.target.value as typeof current.build_stage,
                          shipped_at:
                            e.target.value === "Shipped"
                              ? (current.shipped_at ?? new Date().toISOString().slice(0, 10))
                              : null,
                        })
                      }
                    >
                      {BUILD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Payment
                    <select
                      className={field + " mt-1"}
                      value={current.payment_state}
                      onChange={(e) => update.mutate({ payment_state: e.target.value })}
                    >
                      {PAYMENT_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Hosting account
                    <select
                      className={field + " mt-1"}
                      value={current.hosting_account_id ?? ""}
                      disabled={!isAdmin}
                      onChange={(e) => e.target.value && moveAccount.mutate(e.target.value)}
                    >
                      <option value="">Pick an account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Panel>
            )}

            {/* History SubTab */}
            {projectSubTab === "History" && (
              <Panel title="Account history" right={<Pill tone="mist">{history.length}</Pill>}>
                {history.length === 0 ? (
                  <Empty>This project has never been moved.</Empty>
                ) : (
                  <div className="space-y-2">
                    {history.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {accountOf(t.from_account_id)?.email ?? "—"}
                        </span>
                        <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {accountOf(t.to_account_id)?.email ?? "—"}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {fmtDate(t.moved_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Empty>
              Select a project from the directory or start a new build to view its workspace.
            </Empty>
          </div>
        )}
      </div>

      {/* New Project Modal with Environments */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Start New Project
                </h3>
                <p className="text-xs text-muted-foreground">
                  Creates project with assigned GitHub, Google AI Studio, and Lovable environments
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProjectOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createProjectWithEnvs.mutate();
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Health CRM"
                  value={newProjectForm.projectName}
                  onChange={(e) =>
                    setNewProjectForm({ ...newProjectForm, projectName: e.target.value })
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-foreground mb-1">Client</label>
                  <select
                    value={newProjectForm.clientId}
                    onChange={(e) =>
                      setNewProjectForm({ ...newProjectForm, clientId: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Choose client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Initial Stage</label>
                  <select
                    value={newProjectForm.stage}
                    onChange={(e) =>
                      setNewProjectForm({
                        ...newProjectForm,
                        stage: e.target.value as (typeof BUILD_STAGES)[number],
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    {BUILD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Environment 1: GitHub */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Github className="size-3.5" />
                  GitHub Main Repository Environment
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Repo URL</label>
                    <input
                      type="url"
                      placeholder="https://github.com/agency/app"
                      value={newProjectForm.githubUrl}
                      onChange={(e) =>
                        setNewProjectForm({ ...newProjectForm, githubUrl: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-muted-foreground">Main Repo Email</label>
                      <span className="text-[10px] text-primary">From builder emails</span>
                    </div>
                    <input
                      type="email"
                      placeholder="dev@lovablesolutions.com"
                      value={newProjectForm.githubEmail}
                      onChange={(e) =>
                        setNewProjectForm({ ...newProjectForm, githubEmail: e.target.value })
                      }
                      list="projects-github-accounts-list"
                      className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <datalist id="projects-github-accounts-list">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.email}>
                          {acc.label || acc.email} ({acc.plan || "Pro"})
                        </option>
                      ))}
                    </datalist>
                    {accounts.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {accounts.slice(0, 4).map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() =>
                              setNewProjectForm({ ...newProjectForm, githubEmail: acc.email })
                            }
                            className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition ${
                              newProjectForm.githubEmail === acc.email
                                ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                                : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {acc.email.split("@")[0]}
                          </button>
                        ))}
                      </div>
                    )}
                    {newProjectForm.githubEmail ? (
                      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPwdModalEmail({
                              open: true,
                              email: newProjectForm.githubEmail,
                              label: "Main Repo Email",
                            })
                          }
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                        >
                          <KeyRound className="size-3" /> Edit password for{" "}
                          {newProjectForm.githubEmail}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Environment 2: Google AI Studio */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Cpu className="size-3.5 text-blue-600 dark:text-blue-400" />
                  Google AI Studio Environment
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-muted-foreground">
                    Connected Google Email
                  </label>
                  <input
                    type="email"
                    placeholder="ai-builder@agency.com"
                    value={newProjectForm.aiStudioEmail}
                    onChange={(e) =>
                      setNewProjectForm({ ...newProjectForm, aiStudioEmail: e.target.value })
                    }
                    list="ai-emails-list"
                    className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                  <datalist id="ai-emails-list">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.email} />
                    ))}
                  </datalist>
                  {newProjectForm.aiStudioEmail ? (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: newProjectForm.aiStudioEmail,
                            label: "Google AI Studio",
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for{" "}
                        {newProjectForm.aiStudioEmail}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Environment 3: Lovable */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Lovable Builder Environment
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-muted-foreground">
                    Connected Builder Email
                  </label>
                  <select
                    value={newProjectForm.lovableEmail}
                    onChange={(e) =>
                      setNewProjectForm({ ...newProjectForm, lovableEmail: e.target.value })
                    }
                    className="mt-0.5 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select builder account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.email}>
                        {a.email} ({Number(a.credits_remaining ?? 0).toLocaleString()} cr)
                      </option>
                    ))}
                  </select>
                  {newProjectForm.lovableEmail ? (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: newProjectForm.lovableEmail,
                            label: "Lovable Builder",
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for{" "}
                        {newProjectForm.lovableEmail}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectWithEnvs.isPending}
                  className="gradient-leaf rounded-xl px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 disabled:opacity-50"
                >
                  {createProjectWithEnvs.isPending ? "Creating…" : "Create Project & Environments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Editor Modal */}
      <EmailPasswordModal
        open={pwdModalEmail.open}
        onClose={() => setPwdModalEmail((prev) => ({ ...prev, open: false }))}
        email={pwdModalEmail.email}
        label={pwdModalEmail.label}
      />
    </AppShell>
  );
}
