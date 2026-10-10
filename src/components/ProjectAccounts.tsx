import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRightLeft,
  Bot,
  Building2,
  Check,
  Copy,
  Cpu,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Github,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Mail,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { Empty, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AccountMeta,
  AccountStatus,
  BillingOwner,
  PLATFORMS,
  Platform,
  deleteProjectAccount,
  linkExistingAccount,
  revealProjectAccount,
  saveProjectAccount,
  transferProjectProductAccount,
  unlinkProjectAccount,
  unpackAccountNotes,
} from "@/lib/project-accounts.functions";
import { fmtDate } from "@/lib/agency";
import { fetchMergedAccounts, findAccount } from "@/lib/lovable-accounts-store";
import { EmailPasswordModal } from "@/components/EmailPasswordModal";

const fieldInput =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary";

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Lovable: Sparkles,
  "Google AI Studio": Cpu,
  Manus: Bot,
  GitHub: Github,
  Supabase: Database,
  Vercel: Globe,
  "Domain Registrar": Globe,
  Other: KeyRound,
};

type FormState = {
  id?: string;
  projectId: string;
  platform: Platform;
  custom_platform_label: string;
  email: string;
  username: string;
  url: string;
  password: string;
  plan_tier: string;
  billing_owner: BillingOwner;
  status: AccountStatus;
  notes: string;
  lovable_account_id: string;
  last_verified_at: string;
  linked_project_ids: string[];
};

const defaultForm = (projectId: string): FormState => ({
  projectId,
  platform: "Lovable",
  custom_platform_label: "",
  email: "",
  username: "",
  url: "",
  password: "",
  plan_tier: "",
  billing_owner: "agency",
  status: "active",
  notes: "",
  lovable_account_id: "",
  last_verified_at: new Date().toISOString().slice(0, 10),
  linked_project_ids: [],
});

export type ProjectAccountsProps = {
  projectId?: string;
  clientId?: string;
  onSelectProject?: (projectId: string) => void;
};

export function ProjectAccounts({ projectId, clientId, onSelectProject }: ProjectAccountsProps) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canReveal = role !== "sales";

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");

  // Modal / Form state
  const [modalMode, setModalMode] = useState<"none" | "add" | "edit" | "link">("none");
  const [activeProjectIdForAdd, setActiveProjectIdForAdd] = useState<string>(projectId || "");
  const [formData, setFormData] = useState<FormState>(defaultForm(projectId || ""));
  const [linkAccountId, setLinkAccountId] = useState<string>("");

  // Revealed secrets store
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pwdModalEmail, setPwdModalEmail] = useState<{
    open: boolean;
    email: string;
    accountId?: string;
    label?: string;
  }>({
    open: false,
    email: "",
    accountId: "",
    label: "",
  });

  // Queries
  // 1. Fetch relevant projects (either single project, client projects, or all)
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select(
          "id, project_name, client_id, build_stage, payment_state, hosting_account_id, app_url",
        )
        .order("project_name");
      return data ?? [];
    },
  });

  const clientProjects = useMemo(() => {
    if (projectId) {
      return allProjects.filter((p) => p.id === projectId);
    }
    if (clientId) {
      return allProjects.filter((p) => p.client_id === clientId);
    }
    return allProjects;
  }, [allProjects, projectId, clientId]);

  const targetProjectIds = useMemo(() => clientProjects.map((p) => p.id), [clientProjects]);

  // 2. Fetch all project_accounts
  const { data: rawAccounts = [], refetch: refetchAccounts } = useQuery({
    queryKey: ["all-project-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // 3. Fetch lovable accounts for linking
  const { data: lovableAccounts = [] } = useQuery({
    queryKey: ["lovable-accounts-mini"],
    queryFn: fetchMergedAccounts,
  });

  // Server functions
  const saveFn = useServerFn(saveProjectAccount);
  const revealFn = useServerFn(revealProjectAccount);
  const linkFn = useServerFn(linkExistingAccount);
  const unlinkFn = useServerFn(unlinkProjectAccount);
  const deleteFn = useServerFn(deleteProjectAccount);
  const transferFn = useServerFn(transferProjectProductAccount);

  // Quick Move Modal state
  const [moveModal, setMoveModal] = useState<{
    open: boolean;
    projectId: string;
    projectName: string;
    platform: string;
    currentEmail: string;
    fromAccountId?: string | null;
    toAccountId: string;
    reason: string;
  }>({
    open: false,
    projectId: "",
    projectName: "",
    platform: "all",
    currentEmail: "",
    fromAccountId: null,
    toAccountId: "",
    reason: "",
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!moveModal.projectId || !moveModal.toAccountId) {
        throw new Error("Target project and destination Google account are required.");
      }
      return await transferFn({
        data: {
          projectId: moveModal.projectId,
          platform: moveModal.platform,
          fromAccountId: moveModal.fromAccountId,
          toAccountId: moveModal.toAccountId,
          reason: moveModal.reason,
        },
      });
    },
    onSuccess: (res) => {
      setMoveModal((prev) => ({ ...prev, open: false }));
      toast.success(
        `Moved ${res.platform === "all" ? "all tools" : res.platform} for "${res.projectName}" to ${res.toEmail}`,
      );
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["projects-lookup"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts-mini"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
      qc.invalidateQueries({ queryKey: ["project-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentProject = useMemo(() => {
    if (!projectId) return null;
    return allProjects.find((p) => p.id === projectId) ?? null;
  }, [allProjects, projectId]);

  const hostingAccount = useMemo(() => {
    if (!currentProject?.hosting_account_id) return null;
    return (
      lovableAccounts.find(
        (a) =>
          a.id === currentProject.hosting_account_id ||
          a.email?.toLowerCase() === currentProject.hosting_account_id?.toLowerCase(),
      ) ??
      findAccount(currentProject.hosting_account_id, lovableAccounts) ??
      null
    );
  }, [currentProject, lovableAccounts]);

  // Parse accounts with metadata and project membership
  type ProcessedAccount = (typeof rawAccounts)[number] & {
    meta: AccountMeta;
    allLinkedProjectIds: string[];
    linkedProjects: typeof allProjects;
    displayPlatform: string;
    accountIdentifier: string;
  };

  const processedAccounts: ProcessedAccount[] = useMemo(() => {
    return rawAccounts.map((a) => {
      const meta = unpackAccountNotes(a.notes);
      const allIds = Array.from(new Set([a.project_id, ...(meta.linked_project_ids ?? [])]));
      const linkedProjs = allProjects.filter((p) => allIds.includes(p.id));
      const displayPlat =
        a.platform === "Other" && meta.custom_platform_label
          ? meta.custom_platform_label
          : a.platform;
      const linkedLovable =
        lovableAccounts.find(
          (l) =>
            l.id === a.lovable_account_id ||
            l.email?.toLowerCase() === a.lovable_account_id?.toLowerCase(),
        ) ?? findAccount(a.lovable_account_id, lovableAccounts);
      const identifier = a.email || linkedLovable?.email || a.username || "No identifier";

      return {
        ...a,
        meta,
        allLinkedProjectIds: allIds,
        linkedProjects: linkedProjs,
        displayPlatform: displayPlat,
        accountIdentifier: identifier,
      };
    });
  }, [rawAccounts, allProjects, lovableAccounts]);

  // In-scope accounts for this view
  const scopedAccounts = useMemo(() => {
    if (projectId) {
      return processedAccounts.filter((a) => a.allLinkedProjectIds.includes(projectId));
    }
    if (clientId) {
      const clientProjIdSet = new Set(targetProjectIds);
      return processedAccounts.filter((a) =>
        a.allLinkedProjectIds.some((pId: string) => clientProjIdSet.has(pId)),
      );
    }
    return processedAccounts;
  }, [processedAccounts, projectId, clientId, targetProjectIds]);

  // Filtered accounts based on search and filters
  const filteredAccounts = useMemo(() => {
    return scopedAccounts.filter((acc) => {
      // Platform filter
      if (
        selectedPlatform !== "all" &&
        acc.platform !== selectedPlatform &&
        acc.displayPlatform !== selectedPlatform
      ) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && acc.meta.status !== selectedStatus) {
        return false;
      }
      // Project filter (for aggregated client view)
      if (
        selectedProjectFilter !== "all" &&
        !acc.allLinkedProjectIds.includes(selectedProjectFilter)
      ) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIdent = acc.accountIdentifier.toLowerCase().includes(q);
        const matchUser = acc.username?.toLowerCase().includes(q);
        const matchPlat = acc.displayPlatform.toLowerCase().includes(q);
        const matchUrl = acc.url?.toLowerCase().includes(q);
        const matchNotes = acc.meta.notes?.toLowerCase().includes(q);
        const matchProjects = acc.linkedProjects.some((p: { project_name: string }) =>
          p.project_name.toLowerCase().includes(q),
        );
        if (!matchIdent && !matchUser && !matchPlat && !matchUrl && !matchNotes && !matchProjects) {
          return false;
        }
      }
      return true;
    });
  }, [scopedAccounts, selectedPlatform, selectedStatus, selectedProjectFilter, searchQuery]);

  // Group accounts by platform
  const groupedByPlatform = useMemo(() => {
    const groups: Record<string, ProcessedAccount[]> = {};
    for (const acc of filteredAccounts) {
      const key = acc.platform;
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    }
    return groups;
  }, [filteredAccounts]);

  // Accounts available to link (not yet linked to the current target project)
  const currentLinkTargetProjectId =
    projectId || activeProjectIdForAdd || targetProjectIds[0] || "";
  const reusableAccountsToLink = useMemo(() => {
    if (!currentLinkTargetProjectId) return [];
    return processedAccounts.filter(
      (acc) => !acc.allLinkedProjectIds.includes(currentLinkTargetProjectId),
    );
  }, [processedAccounts, currentLinkTargetProjectId]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (input: FormState) => {
      return saveFn({
        data: {
          id: input.id,
          project_id: input.projectId,
          platform: input.platform,
          custom_platform_label: input.custom_platform_label,
          email: input.email,
          username: input.username,
          url: input.url,
          password: input.password || undefined,
          notes: input.notes,
          status: input.status,
          plan_tier: input.plan_tier,
          billing_owner: input.billing_owner,
          last_verified_at: input.last_verified_at,
          lovable_account_id: input.lovable_account_id || null,
          linked_project_ids: input.linked_project_ids,
          change_reason: input.id
            ? "Updated credentials from Credentials subtab"
            : "Created new platform account",
        },
      });
    },
    onSuccess: () => {
      toast.success(
        formData.id ? "Account updated successfully" : "Platform account created & linked",
      );
      setModalMode("none");
      refetchAccounts();
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMutation = useMutation({
    mutationFn: async ({
      accountId,
      targetProjId,
    }: {
      accountId: string;
      targetProjId: string;
    }) => {
      return linkFn({ data: { accountId, projectId: targetProjId } });
    },
    onSuccess: () => {
      toast.success("Existing account linked to project");
      setModalMode("none");
      refetchAccounts();
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ accountId, projId }: { accountId: string; projId: string }) => {
      return unlinkFn({ data: { accountId, projectId: projId, deleteIfSole: true } });
    },
    onSuccess: (res) => {
      if (res.deleted) {
        toast.success("Account deleted (was sole linked project)");
      } else {
        toast.success("Account unlinked from this project");
      }
      refetchAccounts();
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Account permanently removed");
      refetchAccounts();
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleReveal = async (accountId: string) => {
    if (!canReveal) {
      toast.error("Sales role is not authorized to reveal credentials.");
      return;
    }
    if (revealed[accountId]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      return;
    }
    try {
      const res = await revealFn({ data: { id: accountId } });
      if (!res.password) {
        toast.error("No password or secret is stored for this account.");
        return;
      }
      setRevealed((prev) => ({ ...prev, [accountId]: res.password }));
      toast.success("Secret revealed (access logged)");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to reveal secret");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openAddModal = (forProjId?: string) => {
    const target = forProjId || projectId || targetProjectIds[0] || "";
    setActiveProjectIdForAdd(target);
    setFormData(defaultForm(target));
    setModalMode("add");
  };

  const openEditModal = (acc: ProcessedAccount) => {
    setFormData({
      id: acc.id,
      projectId: acc.project_id,
      platform: acc.platform as Platform,
      custom_platform_label: acc.meta.custom_platform_label || "",
      email: acc.email || "",
      username: acc.username || "",
      url: acc.url || "",
      password: "",
      plan_tier: acc.meta.plan_tier || "",
      billing_owner: acc.meta.billing_owner || "agency",
      status: acc.meta.status || "active",
      notes: acc.meta.notes || "",
      lovable_account_id: acc.lovable_account_id || "",
      last_verified_at: acc.meta.last_verified_at || new Date().toISOString().slice(0, 10),
      linked_project_ids: acc.meta.linked_project_ids || [],
    });
    setModalMode("edit");
  };

  const activeProjectName = useMemo(() => {
    if (projectId) {
      return allProjects.find((p) => p.id === projectId)?.project_name || "Project";
    }
    return "All client projects";
  }, [projectId, allProjects]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Aggregated Metrics (visible especially in Client view or multi-project context) */}
      {clientId && !projectId && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Credentials</p>
            <p className="mt-1 font-display text-2xl font-bold">{scopedAccounts.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Across {clientProjects.length} client projects
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Platforms in Use</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {new Set(scopedAccounts.map((a) => a.displayPlatform)).size}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Lovable, AI Studio, GitHub, etc.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Shared Accounts</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {scopedAccounts.filter((a) => a.allLinkedProjectIds.length > 1).length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Reused in multiple projects</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Agency Billed</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {scopedAccounts.filter((a) => a.meta.billing_owner === "agency").length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {scopedAccounts.filter((a) => a.meta.billing_owner === "client").length} client billed
            </p>
          </div>
        </div>
      )}

      {/* Project Hosting & Google Builder Account Summary Bar */}
      {projectId && currentProject && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="size-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Google Login Account:</span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {hostingAccount ? hostingAccount.email : "Not linked to builder account"}
                </span>
                {hostingAccount && (
                  <Pill
                    tone={Number(hostingAccount.credits_remaining ?? 0) < 500 ? "warn" : "leaf"}
                  >
                    {Number(hostingAccount.credits_remaining ?? 0).toLocaleString()} credits left
                  </Pill>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lovable, Google AI Studio, and Manus log in with Google. If credits run out, switch
                this project to another email below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/apps/emails"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <Layers className="size-3.5" /> Credit Matrix
            </Link>
            <button
              onClick={() => {
                setMoveModal({
                  open: true,
                  projectId: currentProject.id,
                  projectName: currentProject.project_name,
                  platform: "all",
                  currentEmail: hostingAccount?.email || "Unassigned",
                  fromAccountId: currentProject.hosting_account_id,
                  toAccountId: "",
                  reason: "",
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 transition"
            >
              <ArrowRightLeft className="size-3.5 text-primary" /> Switch Email / Move Credits
            </button>
          </div>
        </div>
      )}

      {/* Control / Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search platform, email, project…"
              className="w-full rounded-xl border border-input bg-background pl-9 pr-8 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="transferred">Transferred</option>
          </select>

          {/* Project Filter (if viewing client record with multiple projects) */}
          {clientId && !projectId && clientProjects.length > 1 && (
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Projects ({clientProjects.length})</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {projectId && (
            <button
              onClick={() => {
                setActiveProjectIdForAdd(projectId);
                setModalMode("link");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/70 px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <Link2 className="size-4" /> Link Existing
            </button>
          )}

          <button
            onClick={() => openAddModal()}
            className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            <Plus className="size-4" /> Add Credential
          </button>
        </div>
      </div>

      {/* Role permission disclaimer for sales reps */}
      {!canReveal && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Sales role is permitted to view platform footprint and accounts, but credentials cannot
            be revealed.
          </span>
        </div>
      )}

      {/* Main Content: Grouped by Platform */}
      {filteredAccounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <KeyRound className="mx-auto size-10 text-muted-foreground/60" />
          <h3 className="mt-3 font-display text-base font-semibold">
            No platform credentials found
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {searchQuery || selectedPlatform !== "all" || selectedStatus !== "all"
              ? "No accounts match your search filters. Clear filters to see all accounts."
              : `Link or add platforms like Lovable, Google AI Studio, Manus, GitHub, Supabase, and Vercel for ${activeProjectName}.`}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {searchQuery || selectedPlatform !== "all" || selectedStatus !== "all" ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedPlatform("all");
                  setSelectedStatus("all");
                  setSelectedProjectFilter("all");
                }}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                Clear all filters
              </button>
            ) : (
              <>
                {projectId && (
                  <button
                    onClick={() => {
                      setActiveProjectIdForAdd(projectId);
                      setModalMode("link");
                    }}
                    className="rounded-xl border border-border bg-secondary/80 px-4 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    <Link2 className="mr-1.5 inline size-4" /> Link Existing Account
                  </button>
                )}
                <button
                  onClick={() => openAddModal()}
                  className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Plus className="mr-1.5 inline size-4" /> Add Platform Account
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByPlatform).map(([platKey, accountsInGroup]) => {
            const IconComp = PLATFORM_ICONS[platKey] || KeyRound;
            return (
              <div
                key={platKey}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* Platform Header */}
                <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <IconComp className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold">{platKey}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {accountsInGroup.length}{" "}
                        {accountsInGroup.length === 1 ? "account" : "accounts"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Pill tone="mist">{platKey}</Pill>
                    <button
                      onClick={() => {
                        const target = projectId || targetProjectIds[0] || "";
                        setActiveProjectIdForAdd(target);
                        setFormData({
                          ...defaultForm(target),
                          platform: (PLATFORMS as readonly string[]).includes(platKey)
                            ? (platKey as Platform)
                            : "Other",
                        });
                        setModalMode("add");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                    >
                      <Plus className="size-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Account Cards / Rows */}
                <div className="divide-y divide-border">
                  {accountsInGroup.map((account) => {
                    const isShared = account.allLinkedProjectIds.length > 1;
                    const isRevealed = Boolean(revealed[account.id]);
                    const passwordPlain = revealed[account.id];

                    const linkedGoogleAccount = lovableAccounts.find(
                      (la) =>
                        la.id === account.lovable_account_id ||
                        (account.email && la.email.toLowerCase() === account.email.toLowerCase()),
                    );

                    return (
                      <div key={account.id} className="p-4 sm:p-5 transition hover:bg-secondary/15">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          {/* Left Column: Account Details & Badges */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Identifier (Email / Username) */}
                              <span className="font-display text-base font-semibold text-foreground">
                                {account.accountIdentifier}
                              </span>

                              {/* Status Pill */}
                              <Pill
                                tone={
                                  account.meta.status === "active"
                                    ? "leaf"
                                    : account.meta.status === "expired"
                                      ? "warn"
                                      : "mist"
                                }
                              >
                                {account.meta.status || "active"}
                              </Pill>

                              {/* Billing Owner & Tier */}
                              {account.meta.billing_owner && (
                                <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {account.meta.billing_owner === "agency"
                                    ? "Agency Billed"
                                    : "Client Billed"}
                                </span>
                              )}

                              {account.meta.plan_tier && (
                                <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {account.meta.plan_tier}
                                </span>
                              )}

                              {/* Linked Google Builder Account & Credits */}
                              {linkedGoogleAccount && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  <Sparkles className="size-3" />
                                  Google Account: {linkedGoogleAccount.email} (
                                  {Number(
                                    linkedGoogleAccount.credits_remaining ?? 0,
                                  ).toLocaleString()}{" "}
                                  credits)
                                </span>
                              )}

                              {/* Shared Across Projects Badge */}
                              {isShared && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                                  <Layers className="size-3" />
                                  Used in {account.allLinkedProjectIds.length} projects
                                </span>
                              )}
                            </div>

                            {/* Additional metadata row: username, url, verification */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {account.username &&
                                account.username !== account.accountIdentifier && (
                                  <span>
                                    Username:{" "}
                                    <span className="text-foreground">{account.username}</span>
                                  </span>
                                )}

                              {account.url && (
                                <a
                                  href={account.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  <ExternalLink className="size-3" /> Link / Repo
                                </a>
                              )}

                              {account.meta.last_verified_at && (
                                <span>Verified: {fmtDate(account.meta.last_verified_at)}</span>
                              )}

                              {account.meta.notes && (
                                <span className="italic text-muted-foreground/80">
                                  "{account.meta.notes}"
                                </span>
                              )}
                            </div>

                            {/* Project Link Chips (jumping between projects) */}
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Projects:</span>
                              {account.linkedProjects.map((p: { id: string; project_name: string }) => {
                                const isCurrent = p.id === projectId;
                                return (
                                  <Link
                                    key={p.id}
                                    to="/apps/projects"
                                    search={{ projectId: p.id, tab: "Credentials" }}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                                      isCurrent
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-primary"
                                    }`}
                                  >
                                    <Building2 className="size-3" />
                                    {p.project_name}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>

                          {/* Right Column: Masked Secret, Reveal, Copy, Edit, Delete */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                            {/* Secret Box */}
                            <div className="flex items-center rounded-xl border border-border bg-background px-3 py-1.5">
                              {isRevealed ? (
                                <code className="select-all font-mono text-xs font-semibold text-primary">
                                  {passwordPlain}
                                </code>
                              ) : (
                                <span className="font-mono text-sm tracking-widest text-muted-foreground">
                                  ••••••••••••
                                </span>
                              )}

                              {/* Reveal Toggle */}
                              <button
                                onClick={() => handleReveal(account.id)}
                                disabled={!canReveal}
                                title={
                                  canReveal
                                    ? isRevealed
                                      ? "Hide password"
                                      : "Reveal password"
                                    : "Restricted for sales role"
                                }
                                className="ml-2.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                              >
                                {isRevealed ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>

                              {/* Copy Password Button */}
                              {isRevealed && (
                                <button
                                  onClick={() => handleCopy(passwordPlain || "", account.id)}
                                  title="Copy password"
                                  className="ml-1.5 text-muted-foreground hover:text-primary"
                                >
                                  {copiedId === account.id ? (
                                    <Check className="size-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Move / Switch Google Email button */}
                            <button
                              onClick={() => {
                                const targetProjId = projectId || account.project_id;
                                const targetProj = allProjects.find((p) => p.id === targetProjId);
                                setMoveModal({
                                  open: true,
                                  projectId: targetProjId,
                                  projectName: targetProj?.project_name ?? "Current Project",
                                  platform: account.platform,
                                  currentEmail:
                                    account.email ||
                                    linkedGoogleAccount?.email ||
                                    "Current account",
                                  fromAccountId: linkedGoogleAccount?.id ?? null,
                                  toAccountId: "",
                                  reason: "",
                                });
                              }}
                              className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              title="Switch Google account or move credits for this platform"
                            >
                              <ArrowRightLeft className="size-3.5" />
                            </button>

                            {/* Direct Edit Password button */}
                            {(account.email || linkedGoogleAccount?.email) && (
                              <button
                                onClick={() => {
                                  const targetEmail =
                                    account.email || linkedGoogleAccount?.email || "";
                                  setPwdModalEmail({
                                    open: true,
                                    email: targetEmail,
                                    accountId: linkedGoogleAccount?.id || account.id,
                                    label: account.platform || account.label || "Account",
                                  });
                                }}
                                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                title="Edit password in vault"
                              >
                                <KeyRound className="size-3.5" />
                              </button>
                            )}

                            {/* Edit Action */}
                            <button
                              onClick={() => openEditModal(account)}
                              className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              title="Edit account"
                            >
                              <Edit3 className="size-3.5" />
                            </button>

                            {/* Unlink / Delete Action */}
                            {projectId && isShared ? (
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Unlink this account from ${activeProjectName}? It will remain attached to other projects.`,
                                    )
                                  ) {
                                    unlinkMutation.mutate({
                                      accountId: account.id,
                                      projId: projectId,
                                    });
                                  }
                                }}
                                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Unlink from this project"
                              >
                                <Unlink className="size-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (confirm(`Delete this platform credential permanently?`)) {
                                    deleteMutation.mutate(account.id);
                                  }
                                }}
                                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Delete account"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Dialog: Add New Account or Edit Existing */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold">
                  {modalMode === "edit" ? "Edit Platform Account" : "Add Platform Account"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {modalMode === "edit"
                    ? "Update credential details and credentials will sync across linked projects."
                    : "Create a new credential entry linked to the project."}
                </p>
              </div>
              <button
                onClick={() => setModalMode("none")}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Project Target Selector (if in multi-project client context) */}
              {!projectId && clientProjects.length > 0 && modalMode === "add" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Attach to Project
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className={fieldInput + " mt-1"}
                  >
                    {clientProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Platform Selector */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) =>
                      setFormData({ ...formData, platform: e.target.value as Platform })
                    }
                    className={fieldInput + " mt-1"}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.platform === "Other" && (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Custom Platform Name
                    </label>
                    <input
                      value={formData.custom_platform_label}
                      onChange={(e) =>
                        setFormData({ ...formData, custom_platform_label: e.target.value })
                      }
                      placeholder="e.g. AWS, Stripe, Cloudflare"
                      className={fieldInput + " mt-1"}
                    />
                  </div>
                )}

                {lovableAccounts.length > 0 && (
                  <div className="sm:col-span-2 rounded-xl border border-border bg-secondary/30 p-3">
                    <label className="block text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Link to Saved Google Builder Account</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        Syncs email, password & credits
                      </span>
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                      Since Lovable, Google AI Studio, and Manus log in via Google, selecting a
                      saved account automatically uses its email and Google password.
                    </p>
                    <select
                      value={formData.lovable_account_id}
                      onChange={(e) => {
                        const acc = lovableAccounts.find((a) => a.id === e.target.value);
                        setFormData({
                          ...formData,
                          lovable_account_id: e.target.value,
                          email: acc ? acc.email : formData.email,
                        });
                      }}
                      className={fieldInput}
                    >
                      <option value="">
                        Choose saved Google account (or enter custom credentials below)…
                      </option>
                      {lovableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.email} — {Number(a.credits_remaining ?? 0).toLocaleString()} credits
                          left {a.label ? `(${a.label})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Account Identifier (Email / Username) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Email / Account ID *
                  </label>
                  <input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="account@example.com"
                    className={fieldInput + " mt-1"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Username (Optional)
                  </label>
                  <input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. dev_admin"
                    className={fieldInput + " mt-1"}
                  />
                </div>
              </div>

              {/* Password / Secret */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Password / API Secret{" "}
                  {modalMode === "edit" ? "(Leave blank to keep current)" : ""}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={modalMode === "edit" ? "••••••••••••" : "Password or secret key"}
                  className={fieldInput + " mt-1"}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Encrypted at rest using AES-256-GCM. Masked in UI and reveal is logged.
                </p>
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Platform URL / Repo / Dashboard
                </label>
                <input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://console.cloud.google.com/ or https://github.com/..."
                  className={fieldInput + " mt-1"}
                />
              </div>

              {/* Status, Billing Owner, Plan Tier */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as AccountStatus })
                    }
                    className={fieldInput + " mt-1"}
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="transferred">Transferred to client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Billing Owner
                  </label>
                  <select
                    value={formData.billing_owner}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_owner: e.target.value as BillingOwner })
                    }
                    className={fieldInput + " mt-1"}
                  >
                    <option value="agency">Agency</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Plan / Tier
                  </label>
                  <input
                    value={formData.plan_tier}
                    onChange={(e) => setFormData({ ...formData, plan_tier: e.target.value })}
                    placeholder="e.g. Pro, Team, Free"
                    className={fieldInput + " mt-1"}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional context, 2FA notes, or registrar domain name…"
                  className={fieldInput + " mt-1 resize-none"}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setModalMode("none")}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate(formData)}
                disabled={
                  saveMutation.isPending ||
                  (!formData.email && !formData.url && !formData.lovable_account_id)
                }
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Saving…"
                  : modalMode === "edit"
                    ? "Save Changes"
                    : "Create & Link Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Link Existing Account (Reusable across projects) */}
      {modalMode === "link" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold">Link Existing Platform Account</h3>
                <p className="text-xs text-muted-foreground">
                  Reuse an account already stored on another project without duplicating passwords.
                </p>
              </div>
              <button
                onClick={() => setModalMode("none")}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {reusableAccountsToLink.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No other platform accounts available to link. Create a new account instead.
                  </p>
                  <button
                    onClick={() => {
                      setModalMode("add");
                    }}
                    className="gradient-leaf mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <Plus className="size-4" /> Create New Account
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {reusableAccountsToLink.map((acc) => {
                    const IconComp = PLATFORM_ICONS[acc.platform] || KeyRound;
                    return (
                      <div
                        key={acc.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3.5 transition hover:border-primary/40 hover:bg-secondary/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconComp className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate">
                                {acc.accountIdentifier}
                              </span>
                              <Pill tone="mist">{acc.displayPlatform}</Pill>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              Used in{" "}
                              {acc.linkedProjects.map((p: { project_name: string }) => p.project_name).join(", ") ||
                                "Other project"}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            linkMutation.mutate({
                              accountId: acc.id,
                              targetProjId: currentLinkTargetProjectId,
                            });
                          }}
                          disabled={linkMutation.isPending}
                          className="gradient-leaf rounded-xl px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          <Link2 className="mr-1 inline size-3.5" /> Link to this Project
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <button
                onClick={() => openAddModal()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="size-3.5" /> Need a brand new account instead?
              </button>
              <button
                type="button"
                onClick={() => setModalMode("none")}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Move / Switch Google Account Modal */}
      {moveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ArrowRightLeft className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Switch Google Builder Account</h3>
                  <p className="text-xs text-muted-foreground">
                    Move credits and change the active Google login email
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMoveModal((prev) => ({ ...prev, open: false }))}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-semibold text-foreground">{moveModal.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tool / Platform:</span>
                  <span className="font-semibold text-foreground">
                    {moveModal.platform === "all"
                      ? "All Builder Tools (Whole Project)"
                      : moveModal.platform}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Account:</span>
                  <span className="font-mono text-muted-foreground">{moveModal.currentEmail}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Scope of Transfer
                </label>
                <select
                  value={moveModal.platform}
                  onChange={(e) => setMoveModal((prev) => ({ ...prev, platform: e.target.value }))}
                  className={fieldInput}
                >
                  <option value="all">Whole Project (Lovable, AI Studio, Manus, Hosting)</option>
                  <option value="Lovable">Lovable Only</option>
                  <option value="Google AI Studio">Google AI Studio Only</option>
                  <option value="Manus">Manus Only</option>
                  {PLATFORMS.filter(
                    (p) => !["Lovable", "Google AI Studio", "Manus"].includes(p),
                  ).map((p) => (
                    <option key={p} value={p}>
                      {p} Only
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Transfer To Google Email (with available credits) *
                </label>
                <select
                  value={moveModal.toAccountId}
                  onChange={(e) =>
                    setMoveModal((prev) => ({ ...prev, toAccountId: e.target.value }))
                  }
                  className={fieldInput}
                >
                  <option value="">Select destination Google account…</option>
                  {lovableAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.email} — {Number(acc.credits_remaining ?? 0).toLocaleString()} credits
                      left {acc.label ? `(${acc.label})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason / Migration Notes (Optional)
                </label>
                <input
                  value={moveModal.reason}
                  onChange={(e) => setMoveModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Account credits exhausted; switching to fresh dev account"
                  className={fieldInput}
                />
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>How this works:</strong> The project's credentials for the selected tool
                  will be updated to point to the new Google email account and will utilize its
                  shared Google login & credits. A permanent audit log is recorded in project
                  history.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setMoveModal((prev) => ({ ...prev, open: false }))}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!moveModal.toAccountId || transferMutation.isPending}
                onClick={() => transferMutation.mutate()}
                className="gradient-leaf inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <ArrowRightLeft className="size-4" />
                {transferMutation.isPending ? "Transferring…" : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Password Modal */}
      <EmailPasswordModal
        open={pwdModalEmail.open}
        onClose={() => setPwdModalEmail((prev) => ({ ...prev, open: false }))}
        email={pwdModalEmail.email}
        accountId={pwdModalEmail.accountId}
        label={pwdModalEmail.label}
      />
    </div>
  );
}
