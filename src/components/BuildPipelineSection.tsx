import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardList,
  Hammer,
  FlaskConical,
  Rocket,
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  User,
  Building2,
  Mail,
  Calendar,
  Sparkles,
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  Github,
  Cpu,
  Layers,
  Copy,
  Check,
  Edit3,
  KeyRound,
  BookMarked,
} from "lucide-react";
import { Pill, Panel } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import {
  BuildStage,
  PipelineProject,
  PipelineClient,
  updateLocalProjectStage,
  upsertLocalProject,
  upsertLocalClient,
  PRINCE_MEMBER_NAME,
  PRINCE_MEMBER_ID,
} from "@/lib/pipeline-store";
import { todayISO, fmtDate } from "@/lib/agency";
import {
  extractProjectEnvironments,
  saveProjectEnvironments,
  ProjectEnvironmentData,
} from "@/lib/project-environments";
import { broadcastDbSync, persistWorkflowChange } from "@/lib/database-interconnect";
import { EmailPasswordModal } from "@/components/EmailPasswordModal";

interface HostingAccount {
  id: string;
  email: string;
  label?: string | null;
  credits_remaining?: number | null;
  [key: string]: unknown;
}

interface BuildPipelineSectionProps {
  projects: PipelineProject[];
  clients: PipelineClient[];
  accounts: HostingAccount[];
  prospects?: Array<{ id: string; business_name: string; client_id?: string | null }>;
  currentMemberId?: string | null;
}

const STAGES: Array<{
  id: BuildStage;
  label: string;
  icon: typeof ClipboardList;
  tone: "mist" | "leaf" | "deep" | "warning";
  description: string;
  badgeBg: string;
  borderColor: string;
}> = [
  {
    id: "Planning",
    label: "Planning & Open",
    icon: ClipboardList,
    tone: "mist",
    description: "Scoping, specs & wireframes",
    badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    borderColor: "border-blue-500/30",
  },
  {
    id: "Building",
    label: "Building",
    icon: Hammer,
    tone: "warning",
    description: "Active AI & code generation",
    badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    borderColor: "border-amber-500/30",
  },
  {
    id: "Testing",
    label: "Testing & QA",
    icon: FlaskConical,
    tone: "deep",
    description: "Client review & staging check",
    badgeBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    borderColor: "border-purple-500/30",
  },
  {
    id: "Shipped",
    label: "Shipped & Live",
    icon: Rocket,
    tone: "leaf",
    description: "Deployed to production domain",
    badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    borderColor: "border-emerald-500/30",
  },
];

export function BuildPipelineSection({
  projects,
  clients,
  accounts,
  prospects = [],
  currentMemberId,
}: BuildPipelineSectionProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Query all project accounts to extract environments across platforms
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

  // Controls
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick environment management modal state
  const [editingEnvProject, setEditingEnvProject] = useState<PipelineProject | null>(null);
  const [envForm, setEnvForm] = useState<ProjectEnvironmentData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pwdModalEmail, setPwdModalEmail] = useState<{
    open: boolean;
    email: string;
    label?: string;
  }>({
    open: false,
    email: "",
    label: "",
  });

  const copyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openEnvModal = (p: PipelineProject) => {
    const envData = extractProjectEnvironments(p, projectAccounts, accounts);
    setEnvForm(envData);
    setEditingEnvProject(p);
  };

  const saveEnvMutation = useMutation({
    mutationFn: async () => {
      if (!editingEnvProject || !envForm) return;
      await saveProjectEnvironments({
        projectId: editingEnvProject.id,
        github: envForm.github,
        googleAiStudio: envForm.googleAiStudio,
        lovable: envForm.lovable,
      });
    },
    onSuccess: () => {
      toast.success("Project environments updated");
      setEditingEnvProject(null);
      setEnvForm(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update environments"),
  });

  // New Project Form State with all 3 environments
  const [form, setForm] = useState({
    projectName: "",
    businessName: "",
    industry: "",
    onboardedBy: PRINCE_MEMBER_NAME,
    clientId: "",
    hostingAccountId: "",
    initialStage: "Planning" as BuildStage,
    dueAt: "",
    appUrl: "",
    isNewClient: false,
    githubUrl: "",
    githubEmail: "dev@lovablesolutions.com",
    aiStudioEmail: "",
    lovableEmail: "",
  });

  // Client lookup helper
  const clientMap = useMemo(() => {
    const map = new Map<string, PipelineClient>();
    for (const c of clients) {
      map.set(c.id, c);
      map.set(c.business_name.toLowerCase(), c);
    }
    return map;
  }, [clients]);

  // Account lookup helper
  const accountMap = useMemo(() => {
    const map = new Map<string, HostingAccount>();
    for (const a of accounts) {
      map.set(a.id, a);
    }
    return map;
  }, [accounts]);

  // Unique industries
  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      if (c.industry && c.industry.trim() !== "—") {
        set.add(c.industry.trim());
      }
    }
    for (const p of projects) {
      if (p.industry && p.industry.trim() !== "—") {
        set.add(p.industry.trim());
      }
    }
    return Array.from(set).sort();
  }, [clients, projects]);

  // Enriched & filtered projects with environments
  const enrichedProjects = useMemo(() => {
    return projects.map((p) => {
      const client = clientMap.get(p.client_id) || clientMap.get(p.project_name.toLowerCase());
      const account = p.hosting_account_id ? accountMap.get(p.hosting_account_id) : null;
      const clientIndustry = client?.industry || p.industry || "—";
      const repName = p.onboarded_by_name || client?.onboarded_by_name || PRINCE_MEMBER_NAME;
      const envs = extractProjectEnvironments(p, projectAccounts, accounts);

      return {
        ...p,
        clientName: client?.business_name || p.project_name,
        clientIndustry: clientIndustry === "—" ? null : clientIndustry,
        repName,
        accountEmail: account?.email || null,
        accountCredits: account?.credits_remaining ?? null,
        envs,
      };
    });
  }, [projects, clientMap, accountMap, projectAccounts, accounts]);

  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        p.project_name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.clientIndustry && p.clientIndustry.toLowerCase().includes(q)) ||
        p.repName.toLowerCase().includes(q) ||
        (p.accountEmail && p.accountEmail.toLowerCase().includes(q)) ||
        p.envs.github.repo_url.toLowerCase().includes(q) ||
        p.envs.github.email.toLowerCase().includes(q) ||
        p.envs.googleAiStudio.email.toLowerCase().includes(q) ||
        p.envs.lovable.email.toLowerCase().includes(q);

      const matchesStage = stageFilter === "all" || p.build_stage === stageFilter;
      const matchesIndustry =
        industryFilter === "all" ||
        (industryFilter === "none" ? !p.clientIndustry : p.clientIndustry === industryFilter);

      return matchesSearch && matchesStage && matchesIndustry;
    });
  }, [enrichedProjects, searchQuery, stageFilter, industryFilter]);

  // Move stage mutation with optimistic cache update & local storage persistence
  const moveStageMutation = useMutation({
    mutationFn: async ({
      id,
      stage,
      clientId,
    }: {
      id: string;
      stage: BuildStage;
      clientId: string | null;
    }) => {
      // 1. Optimistically update TanStack query data
      qc.setQueryData(["projects"], (old: PipelineProject[] | undefined) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, build_stage: stage } : p));
      });

      // 2. Full database interconnect: 0ms local update, Supabase sync with retry queue, and audit log
      await persistWorkflowChange({
        projectId: id,
        stage,
        clientId,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Moved to ${variables.stage}`);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Start new project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      let assignedClientId = form.clientId;

      // If creating new client inline
      if (form.isNewClient || !assignedClientId) {
        const newClientId = `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newClient: PipelineClient = {
          id: newClientId,
          business_name: form.businessName || form.projectName,
          industry: form.industry ? form.industry : null,
          onboarded_by: currentMemberId || PRINCE_MEMBER_ID,
          onboarded_by_name: form.onboardedBy || PRINCE_MEMBER_NAME,
          signed_date: todayISO(),
          status: "Active",
          app_status: "Live",
          app_url: form.appUrl || null,
          build_stage: form.initialStage,
          build_started_at: todayISO(),
          shipped_at: form.initialStage === "Shipped" ? todayISO() : null,
          project_name: form.projectName,
          hosting_account_id: form.hostingAccountId || null,
          contact_name: null,
          contact_email: null,
          contact_phone: null,
          created_at: now,
        };

        upsertLocalClient(newClient);
        assignedClientId = newClientId;

        // Try DB
        try {
          await supabase.from("clients").insert({
            id: newClientId,
            business_name: newClient.business_name,
            industry: newClient.industry,
            onboarded_by: currentMemberId || null,
            signed_date: todayISO(),
            status: "Active",
            project_name: form.projectName,
            build_stage: form.initialStage,
            hosting_account_id: form.hostingAccountId || null,
          });
        } catch {
          // fallback to local
        }
      }

      // Create new project with assigned environments: GitHub, Google AI Studio, Lovable
      const newProjectId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const defaultSlug = form.projectName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-");

      const ghUrl = form.githubUrl.trim() || `https://github.com/lovable-solutions/${defaultSlug}`;
      const ghEmail = form.githubEmail.trim() || "dev@lovablesolutions.com";
      const aiEmail =
        form.aiStudioEmail.trim() ||
        (accounts[0]?.email ?? "ai-builder@lovablesolutions.com");
      const lovEmail =
        form.lovableEmail.trim() ||
        (accounts[0]?.email ?? "princeyvon30@gmail.com");

      const targetLovableAcc = accounts.find(
        (a) => a.email.toLowerCase() === lovEmail.toLowerCase(),
      );
      const targetAiAcc = accounts.find((a) => a.email.toLowerCase() === aiEmail.toLowerCase());

      const newProject: PipelineProject = {
        id: newProjectId,
        project_name: form.projectName,
        client_id: assignedClientId,
        hosting_account_id: targetLovableAcc?.id || form.hostingAccountId || null,
        built_by: currentMemberId || PRINCE_MEMBER_ID,
        build_stage: form.initialStage,
        app_url: form.appUrl || `https://${defaultSlug}.lovable.app`,
        started_at: todayISO(),
        shipped_at: form.initialStage === "Shipped" ? todayISO() : null,
        due_at: form.dueAt || null,
        notes: `Onboarded by ${form.onboardedBy || PRINCE_MEMBER_NAME}`,
        payment_state: "Open",
        created_at: now,
        updated_at: now,
        prospect_id: null,
        onboarded_by_name: form.onboardedBy || PRINCE_MEMBER_NAME,
        industry: form.industry || undefined,
        github_repo_url: ghUrl,
        github_email: ghEmail,
        google_ai_studio_email: aiEmail,
        google_ai_studio_url: "https://aistudio.google.com",
        lovable_email: lovEmail,
        lovable_url: `https://lovable.dev/projects/${newProjectId}`,
      };

      // 1. Synchronously save in local store
      upsertLocalProject(newProject);

      // 2. Try DB insert
      try {
        await supabase.from("projects").insert({
          id: newProjectId,
          project_name: newProject.project_name,
          client_id: assignedClientId,
          hosting_account_id: newProject.hosting_account_id,
          built_by: currentMemberId || null,
          build_stage: newProject.build_stage,
          app_url: newProject.app_url,
          started_at: todayISO(),
          payment_state: "Open",
          due_at: newProject.due_at,
        });
      } catch {
        // fallback to local store
      }

      // 3. Persist and assign all 3 environments (GitHub, Google AI Studio, Lovable)
      try {
        await saveProjectEnvironments({
          projectId: newProjectId,
          github: {
            repo_url: ghUrl,
            email: ghEmail,
          },
          googleAiStudio: {
            email: aiEmail,
            url: "https://aistudio.google.com",
            account_id: targetAiAcc?.id,
          },
          lovable: {
            email: lovEmail,
            url: newProject.app_url || `https://lovable.dev/projects/${newProjectId}`,
            account_id: targetLovableAcc?.id,
          },
        });
      } catch (err) {
        console.warn("Environments assignment warning:", err);
      }
    },
    onSuccess: () => {
      toast.success("Project added to build pipeline with all 3 environments assigned");
      setIsModalOpen(false);
      setForm({
        projectName: "",
        businessName: "",
        industry: "",
        onboardedBy: PRINCE_MEMBER_NAME,
        clientId: "",
        hostingAccountId: "",
        initialStage: "Planning",
        dueAt: "",
        appUrl: "",
        isNewClient: false,
        githubUrl: "",
        githubEmail: "dev@lovablesolutions.com",
        aiStudioEmail: "",
        lovableEmail: "",
      });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stage advance helper
  const advanceStage = (
    id: string,
    currentStage: BuildStage,
    clientId: string | null,
    forward: boolean,
  ) => {
    const stageOrder: BuildStage[] = ["Planning", "Building", "Testing", "Shipped"];
    const currentIndex = stageOrder.indexOf(currentStage);
    const nextIndex = forward ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < stageOrder.length) {
      moveStageMutation.mutate({
        id,
        stage: stageOrder[nextIndex]!,
        clientId,
      });
    }
  };

  return (
    <Panel
      title={
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Hammer className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold tracking-tight text-foreground">
                Build pipeline
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {enrichedProjects.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time development workflow from scoping to live shipment
            </p>
          </div>
        </div>
      }
      right={
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === "board"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="size-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Detailed Table View"
            >
              <ListIcon className="size-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* AI Library Shortcut */}
          <Link
            to="/library/skills"
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
            title="Browse Skills, SOPs, and AI Prompts"
          >
            <BookMarked className="size-3.5 text-primary" />
            <span className="hidden sm:inline">AI Library</span>
          </Link>

          {/* New Project Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="size-3.5" />
            <span>Start project</span>
          </button>
        </div>
      }
    >
      {/* Pipeline Summary Metrics Banner */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((s) => {
          const count = enrichedProjects.filter((p) => p.build_stage === s.id).length;
          const percentage = enrichedProjects.length
            ? Math.round((count / enrichedProjects.length) * 100)
            : 0;
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              onClick={() => setStageFilter((curr) => (curr === s.id ? "all" : s.id))}
              className={`cursor-pointer rounded-xl border p-3 transition hover:border-primary/50 ${
                stageFilter === s.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-6 items-center justify-center rounded-md border ${s.badgeBg}`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{s.label}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{count}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{s.description}</span>
                <span className="font-mono">{percentage}%</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, client, industry…"
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none"
          >
            <option value="all">All Stages ({enrichedProjects.length})</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({enrichedProjects.filter((p) => p.build_stage === s.id).length})
              </option>
            ))}
          </select>

          {/* Industry Filter */}
          {industries.length > 0 && (
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none"
            >
              <option value="all">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
              <option value="none">General / Unspecified</option>
            </select>
          )}

          {(stageFilter !== "all" || industryFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setStageFilter("all");
                setIndustryFilter("all");
                setSearchQuery("");
              }}
              className="h-8 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* VIEW: KANBAN BOARD */}
      {viewMode === "board" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s) => {
            const list = filteredProjects.filter((p) => p.build_stage === s.id);
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className="flex flex-col rounded-2xl border border-border bg-card/40 p-3 shadow-xs"
              >
                {/* Stage Header */}
                <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-6 items-center justify-center rounded-md border ${s.badgeBg}`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {s.label}
                    </span>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-foreground">
                    {list.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {list.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-4 text-center">
                      <p className="text-xs text-muted-foreground">No projects in {s.label}</p>
                      <button
                        onClick={() => {
                          setForm((curr) => ({ ...curr, initialStage: s.id }));
                          setIsModalOpen(true);
                        }}
                        className="mt-2 text-[11px] font-semibold text-primary hover:underline"
                      >
                        + Add to {s.label}
                      </button>
                    </div>
                  ) : (
                    list.map((p) => (
                      <div
                        key={p.id}
                        className="group rounded-xl border border-border/80 bg-card p-3 shadow-xs transition hover:border-primary/50 hover:shadow-sm"
                      >
                        {/* Project Title & Client Link */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/apps/projects"
                            className="text-sm font-semibold text-foreground transition hover:text-primary"
                          >
                            {p.project_name}
                          </Link>
                          <Link
                            to="/apps/projects"
                            className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                            title="Open project details"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>

                        {/* Client & Industry info */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building2 className="size-3 text-muted-foreground" />
                            {p.clientName}
                          </span>
                          {p.clientIndustry && (
                            <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {p.clientIndustry}
                            </span>
                          )}
                        </div>

                        {/* Onboarded By & Status */}
                        <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="size-3" />
                              Onboarded:
                            </span>
                            <span className="font-medium text-foreground">{p.repName}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Active · Open
                            </span>
                          </div>
                        </div>

                        {/* Assigned Environments (GitHub, Google AI Studio, Lovable) */}
                        <div className="mt-2.5 space-y-1.5 rounded-xl border border-border/80 bg-secondary/30 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                              <Layers className="size-3 text-primary" /> Environments
                            </span>
                            <button
                              type="button"
                              onClick={() => openEnvModal(p)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                              title="Configure project environments"
                            >
                              <Edit3 className="size-2.5" />
                              <span>Configure</span>
                            </button>
                          </div>

                          {/* 1. GitHub Main Repo */}
                          <div className="flex items-center justify-between gap-1 rounded-lg border border-border/60 bg-card/80 px-2 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Github className="size-3 shrink-0 text-foreground" />
                              <a
                                href={p.envs.github.repo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-mono text-[10px] text-foreground hover:text-primary hover:underline"
                                title={`GitHub repo: ${p.envs.github.repo_url}`}
                              >
                                {p.envs.github.repo_url.replace(/^https?:\/\/github\.com\//, "") ||
                                  "repo"}
                              </a>
                              <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="truncate max-w-[80px] text-[10px] text-muted-foreground"
                                title={p.envs.github.email}
                              >
                                {p.envs.github.email.split("@")[0]}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(p.envs.github.email, `gh-email-${p.id}`)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                title="Copy repo email"
                              >
                                {copiedKey === `gh-email-${p.id}` ? (
                                  <Check className="size-2.5 text-primary" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* 2. Google AI Studio */}
                          <div className="flex items-center justify-between gap-1 rounded-lg border border-border/60 bg-card/80 px-2 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Cpu className="size-3 shrink-0 text-blue-500 dark:text-blue-400" />
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                AI Studio:
                              </span>
                              <span
                                className="truncate text-[10px] font-medium text-foreground"
                                title={p.envs.googleAiStudio.email}
                              >
                                {p.envs.googleAiStudio.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  copyText(p.envs.googleAiStudio.email, `ai-email-${p.id}`)
                                }
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                title="Copy AI Studio email"
                              >
                                {copiedKey === `ai-email-${p.id}` ? (
                                  <Check className="size-2.5 text-primary" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </button>
                              <a
                                href={p.envs.googleAiStudio.url || "https://aistudio.google.com"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                title="Open Google AI Studio"
                              >
                                open
                              </a>
                            </div>
                          </div>

                          {/* 3. Lovable */}
                          <div className="flex items-center justify-between gap-1 rounded-lg border border-border/60 bg-card/80 px-2 py-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Sparkles className="size-3 shrink-0 text-primary" />
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                Lovable:
                              </span>
                              <span
                                className="truncate text-[10px] font-medium text-foreground"
                                title={p.envs.lovable.email}
                              >
                                {p.envs.lovable.email}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {p.envs.lovable.credits != null && (
                                <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-semibold text-primary">
                                  {p.envs.lovable.credits} cr
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => copyText(p.envs.lovable.email, `lov-email-${p.id}`)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                title="Copy Lovable email"
                              >
                                {copiedKey === `lov-email-${p.id}` ? (
                                  <Check className="size-2.5 text-primary" />
                                ) : (
                                  <Copy className="size-2.5" />
                                )}
                              </button>
                              {p.envs.lovable.url ? (
                                <a
                                  href={p.envs.lovable.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-semibold text-primary hover:underline"
                                  title="Open Lovable project"
                                >
                                  open
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Stage Stepper & Controls */}
                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => advanceStage(p.id, p.build_stage, p.client_id, false)}
                              disabled={p.build_stage === "Planning"}
                              className="flex size-6 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                              title="Move back to previous stage"
                            >
                              <ChevronLeft className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => advanceStage(p.id, p.build_stage, p.client_id, true)}
                              disabled={p.build_stage === "Shipped"}
                              className="flex size-6 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                              title="Advance to next stage"
                            >
                              <ChevronRight className="size-3.5" />
                            </button>
                          </div>

                          <select
                            value={p.build_stage}
                            onChange={(e) =>
                              moveStageMutation.mutate({
                                id: p.id,
                                stage: e.target.value as BuildStage,
                                clientId: p.client_id,
                              })
                            }
                            className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground outline-none transition focus:border-primary"
                          >
                            {STAGES.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW: STRUCTURED TABLE */
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Business / Project</th>
                <th className="py-2.5 px-3 font-semibold">Industry</th>
                <th className="py-2.5 px-3 font-semibold">Onboarded by</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Build Stage</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Environments</th>
                <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No projects found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => (
                  <tr key={p.id} className="transition hover:bg-secondary/30">
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      <div className="flex flex-col">
                        <Link
                          to="/apps/projects"
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {p.project_name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground">{p.clientName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {p.clientIndustry ? (
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {p.clientIndustry}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3 text-muted-foreground" />
                        <span>{p.repName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={p.build_stage}
                        onChange={(e) =>
                          moveStageMutation.mutate({
                            id: p.id,
                            stage: e.target.value as BuildStage,
                            clientId: p.client_id,
                          })
                        }
                        className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground outline-none"
                      >
                        {STAGES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-1 text-[11px]">
                        {/* GitHub */}
                        <div className="flex items-center gap-1.5">
                          <Github className="size-3 shrink-0 text-foreground" />
                          <a
                            href={p.envs.github.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate max-w-[130px] font-mono text-[10px] text-foreground hover:text-primary hover:underline"
                            title={`GitHub repo: ${p.envs.github.repo_url}`}
                          >
                            {p.envs.github.repo_url.replace(/^https?:\/\/github\.com\//, "") ||
                              "repo"}
                          </a>
                          <span className="text-[10px] text-muted-foreground">
                            ({p.envs.github.email.split("@")[0]})
                          </span>
                        </div>
                        {/* Google AI Studio */}
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Cpu className="size-3 shrink-0 text-blue-500" />
                          <span
                            className="truncate max-w-[120px] text-foreground"
                            title={p.envs.googleAiStudio.email}
                          >
                            {p.envs.googleAiStudio.email}
                          </span>
                          <a
                            href={p.envs.googleAiStudio.url || "https://aistudio.google.com"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            studio
                          </a>
                        </div>
                        {/* Lovable */}
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Sparkles className="size-3 shrink-0 text-primary" />
                          <span
                            className="truncate max-w-[120px] text-foreground"
                            title={p.envs.lovable.email}
                          >
                            {p.envs.lovable.email}
                          </span>
                          {p.envs.lovable.credits != null && (
                            <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-semibold text-primary">
                              {p.envs.lovable.credits} cr
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => advanceStage(p.id, p.build_stage, p.client_id, true)}
                          disabled={p.build_stage === "Shipped"}
                          className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary disabled:opacity-30"
                          title="Advance stage"
                        >
                          <span>Next</span>
                          <ChevronRight className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEnvModal(p)}
                          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Configure Environments"
                        >
                          <Layers className="size-3.5 text-primary" />
                        </button>
                        <Link
                          to="/apps/projects"
                          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Open Details"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* START PROJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  Start new project in pipeline
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Project Name */}
              <div>
                <label className="mb-1 block font-medium text-foreground">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={form.projectName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((curr) => ({
                      ...curr,
                      projectName: val,
                      businessName: curr.businessName ? curr.businessName : val,
                    }));
                  }}
                  placeholder="e.g. FireGuard or Fleet OS"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Client Mode Switch */}
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 text-xs">
                <span className="text-muted-foreground">Client association:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((curr) => ({ ...curr, isNewClient: false }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      !form.isNewClient
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    Existing Client
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((curr) => ({ ...curr, isNewClient: true, clientId: "" }))
                    }
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      form.isNewClient
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    + New Client
                  </button>
                </div>
              </div>

              {form.isNewClient ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-medium text-foreground">
                      Client Business Name
                    </label>
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) =>
                        setForm((curr) => ({ ...curr, businessName: e.target.value }))
                      }
                      placeholder="e.g. FireGuard"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-foreground">
                      Industry (optional)
                    </label>
                    <input
                      type="text"
                      value={form.industry}
                      onChange={(e) => setForm((curr) => ({ ...curr, industry: e.target.value }))}
                      placeholder="e.g. Food & Beverage"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block font-medium text-foreground">Select Client</label>
                  <select
                    value={form.clientId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      const matched = clients.find((c) => c.id === cId);
                      setForm((curr) => ({
                        ...curr,
                        clientId: cId,
                        projectName: curr.projectName
                          ? curr.projectName
                          : matched?.business_name || "",
                      }));
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Choose an existing client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name} {c.industry ? `(${c.industry})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Onboarded by and Initial Stage */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Onboarded by</label>
                  <input
                    type="text"
                    value={form.onboardedBy}
                    onChange={(e) => setForm((curr) => ({ ...curr, onboardedBy: e.target.value }))}
                    placeholder="e.g. princeyvon30"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Initial Stage</label>
                  <select
                    value={form.initialStage}
                    onChange={(e) =>
                      setForm((curr) => ({ ...curr, initialStage: e.target.value as BuildStage }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hosting account & App URL */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Hosting Account</label>
                  <select
                    value={form.hostingAccountId}
                    onChange={(e) =>
                      setForm((curr) => ({ ...curr, hostingAccountId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Unassigned</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Target Due Date</label>
                  <input
                    type="date"
                    value={form.dueAt}
                    onChange={(e) => setForm((curr) => ({ ...curr, dueAt: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">App URL (optional)</label>
                <input
                  type="url"
                  value={form.appUrl}
                  onChange={(e) => setForm((curr) => ({ ...curr, appUrl: e.target.value }))}
                  placeholder="https://app.lovable.dev/..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Assigned Environments: GitHub, Google AI Studio, Lovable */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Layers className="size-3.5 text-primary" />
                    <span>Assigned Environments</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    GitHub · AI Studio · Lovable
                  </span>
                </div>

                {/* 1. GitHub Environment */}
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                    <Github className="size-3" /> GitHub Main Repository
                  </label>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <div>
                      <input
                        type="url"
                        value={form.githubUrl}
                        onChange={(e) =>
                          setForm((curr) => ({ ...curr, githubUrl: e.target.value }))
                        }
                        placeholder={
                          form.projectName
                            ? `https://github.com/lovable-solutions/${form.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
                            : "https://github.com/lovable-solutions/..."
                        }
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        Main repository link
                      </span>
                    </div>
                    <div>
                      <input
                        type="email"
                        value={form.githubEmail}
                        onChange={(e) =>
                          setForm((curr) => ({ ...curr, githubEmail: e.target.value }))
                        }
                        list="pipeline-github-accounts-list"
                        placeholder="dev@lovablesolutions.com"
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                      <datalist id="pipeline-github-accounts-list">
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.email}>
                            {acc.label || acc.email} ({(acc as { plan?: string }).plan || "Pro"})
                          </option>
                        ))}
                      </datalist>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          Main repo connected email
                        </span>
                        {accounts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {accounts.slice(0, 3).map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() =>
                                  setForm((curr) => ({ ...curr, githubEmail: acc.email }))
                                }
                                className={`rounded px-1 py-0.2 text-[9px] font-medium transition ${
                                  form.githubEmail === acc.email
                                    ? "bg-primary/20 text-primary font-semibold"
                                    : "bg-secondary/70 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {acc.email.split("@")[0]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {form.githubEmail ? (
                        <div className="mt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setPwdModalEmail({
                                open: true,
                                email: form.githubEmail,
                                label: "Main Repo Email",
                              })
                            }
                            className="flex items-center gap-1 text-[10px] font-semibold text-primary transition hover:underline"
                          >
                            <KeyRound className="size-3" /> Edit password for {form.githubEmail}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 2. Google AI Studio Environment */}
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                    <Cpu className="size-3 text-blue-500" /> Google AI Studio Connected Email
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="email"
                      value={form.aiStudioEmail}
                      onChange={(e) =>
                        setForm((curr) => ({ ...curr, aiStudioEmail: e.target.value }))
                      }
                      placeholder={accounts[0]?.email || "ai-builder@lovablesolutions.com"}
                      className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                    {accounts.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value)
                            setForm((curr) => ({ ...curr, aiStudioEmail: e.target.value }));
                        }}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground outline-none"
                      >
                        <option value="">Choose account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.email}>
                            {a.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {form.aiStudioEmail ? (
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: form.aiStudioEmail,
                            label: "Google AI Studio",
                          })
                        }
                        className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for {form.aiStudioEmail}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* 3. Lovable Environment */}
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                    <Sparkles className="size-3 text-primary" /> Lovable Connected Email
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="email"
                      value={form.lovableEmail}
                      onChange={(e) =>
                        setForm((curr) => ({ ...curr, lovableEmail: e.target.value }))
                      }
                      placeholder={accounts[0]?.email || "princeyvon30@gmail.com"}
                      className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                    {accounts.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value)
                            setForm((curr) => ({ ...curr, lovableEmail: e.target.value }));
                        }}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground outline-none"
                      >
                        <option value="">Choose account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.email}>
                            {a.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {form.lovableEmail ? (
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: form.lovableEmail,
                            label: "Lovable Builder",
                          })
                        }
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for {form.lovableEmail}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/80 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createProjectMutation.mutate()}
                disabled={
                  !form.projectName || (!form.isNewClient && !form.clientId && !form.businessName)
                }
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Save project to pipeline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE ENVIRONMENTS MODAL FOR WORKFLOW */}
      {editingEnvProject && envForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Layers className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    Project Environments — {editingEnvProject.project_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Assign and update GitHub main repo, Google AI Studio, and Lovable environments
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingEnvProject(null);
                  setEnvForm(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* 1. GitHub Environment */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Github className="size-4" />
                    <span>GitHub Main Repo Environment</span>
                  </div>
                  <span className="rounded bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground dark:bg-neutral-800">
                    main repo
                  </span>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">Repository Link</label>
                  <input
                    type="url"
                    value={envForm.github.repo_url}
                    onChange={(e) =>
                      setEnvForm({
                        ...envForm,
                        github: { ...envForm.github, repo_url: e.target.value },
                      })
                    }
                    placeholder="https://github.com/organization/repo"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="font-medium text-foreground">Connected Repo Email</label>
                    <span className="text-[10px] text-primary">From builder emails list</span>
                  </div>
                  <input
                    type="email"
                    value={envForm.github.email}
                    onChange={(e) =>
                      setEnvForm({
                        ...envForm,
                        github: { ...envForm.github, email: e.target.value },
                      })
                    }
                    list="manage-github-accounts-list"
                    placeholder="dev@lovablesolutions.com"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                  <datalist id="manage-github-accounts-list">
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.email}>
                        {acc.label || acc.email} ({(acc as { plan?: string }).plan || "Pro"})
                      </option>
                    ))}
                  </datalist>
                  {accounts.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Quick pick:</span>
                      {accounts.slice(0, 4).map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() =>
                            setEnvForm({
                              ...envForm,
                              github: { ...envForm.github, email: acc.email },
                            })
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                            envForm.github.email === acc.email
                              ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                              : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {acc.email.split("@")[0]}
                        </button>
                      ))}
                    </div>
                  )}
                  {envForm.github.email ? (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envForm.github.email,
                            label: "Main Repo Email",
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for {envForm.github.email}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2. Google AI Studio Environment */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Cpu className="size-4 text-blue-500" />
                    <span>Google AI Studio Environment</span>
                  </div>
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    Connected
                  </span>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">
                    Connected Google Email
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={envForm.googleAiStudio.email}
                      onChange={(e) =>
                        setEnvForm({
                          ...envForm,
                          googleAiStudio: { ...envForm.googleAiStudio, email: e.target.value },
                        })
                      }
                      placeholder="ai-builder@lovablesolutions.com"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                    {accounts.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setEnvForm({
                              ...envForm,
                              googleAiStudio: { ...envForm.googleAiStudio, email: e.target.value },
                            });
                          }
                        }}
                        className="h-8.5 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none"
                      >
                        <option value="">Pick account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.email}>
                            {a.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {envForm.googleAiStudio.email ? (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envForm.googleAiStudio.email,
                            label: "Google AI Studio",
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for{" "}
                        {envForm.googleAiStudio.email}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">
                    Studio URL / Prompt Link
                  </label>
                  <input
                    type="url"
                    value={envForm.googleAiStudio.url || "https://aistudio.google.com"}
                    onChange={(e) =>
                      setEnvForm({
                        ...envForm,
                        googleAiStudio: { ...envForm.googleAiStudio, url: e.target.value },
                      })
                    }
                    placeholder="https://aistudio.google.com"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* 3. Lovable Environment */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    <span>Lovable Environment</span>
                  </div>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Connected
                  </span>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">
                    Connected Lovable Email
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={envForm.lovable.email}
                      onChange={(e) => {
                        const email = e.target.value;
                        const match = accounts.find(
                          (a) => a.email.toLowerCase() === email.toLowerCase(),
                        );
                        setEnvForm({
                          ...envForm,
                          lovable: {
                            ...envForm.lovable,
                            email,
                            account_id: match?.id || envForm.lovable.account_id,
                            credits: match?.credits_remaining ?? envForm.lovable.credits,
                          },
                        });
                      }}
                      placeholder="princeyvon30@gmail.com"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                    {accounts.length > 0 && (
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          const match = accounts.find((a) => a.email === val);
                          if (val) {
                            setEnvForm({
                              ...envForm,
                              lovable: {
                                ...envForm.lovable,
                                email: val,
                                account_id: match?.id,
                                credits: match?.credits_remaining ?? null,
                              },
                            });
                          }
                        }}
                        className="h-8.5 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none"
                      >
                        <option value="">Pick account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.email}>
                            {a.email}{" "}
                            {a.credits_remaining != null ? `(${a.credits_remaining} cr)` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {envForm.lovable.email ? (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envForm.lovable.email,
                            label: "Lovable Builder",
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                      >
                        <KeyRound className="size-3" /> Edit password for {envForm.lovable.email}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">
                    Lovable Project URL
                  </label>
                  <input
                    type="url"
                    value={envForm.lovable.url || ""}
                    onChange={(e) =>
                      setEnvForm({
                        ...envForm,
                        lovable: { ...envForm.lovable, url: e.target.value },
                      })
                    }
                    placeholder={`https://lovable.dev/projects/${editingEnvProject.id}`}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/80 pt-3">
              <button
                type="button"
                onClick={() => {
                  setEditingEnvProject(null);
                  setEnvForm(null);
                }}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEnvMutation.mutate()}
                disabled={saveEnvMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                <span>{saveEnvMutation.isPending ? "Saving…" : "Save Environments"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Email Password Modal */}
      <EmailPasswordModal
        open={pwdModalEmail.open}
        onClose={() => setPwdModalEmail((prev) => ({ ...prev, open: false }))}
        email={pwdModalEmail.email}
        label={pwdModalEmail.label}
      />
    </Panel>
  );
}
