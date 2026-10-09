import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Check,
  Github,
  Cpu,
  Sparkles,
  Edit3,
  Layers,
  Mail,
  ShieldCheck,
  X,
  AlertCircle,
  Link2,
  Coins,
  ArrowRightLeft,
  KeyRound,
  BookMarked,
} from "lucide-react";
import { EmailPasswordModal } from "@/components/EmailPasswordModal";
import { supabase } from "@/integrations/supabase/client";
import { PipelineProject } from "@/lib/pipeline-store";
import {
  extractProjectEnvironments,
  saveProjectEnvironments,
  ProjectEnvironmentData,
} from "@/lib/project-environments";
import { fetchMergedAccounts } from "@/lib/lovable-accounts-store";

interface ProjectEnvironmentsHubProps {
  project: PipelineProject;
  onEnvironmentsUpdated?: () => void;
  className?: string;
}

export function ProjectEnvironmentsHub({
  project,
  onEnvironmentsUpdated,
  className = "",
}: ProjectEnvironmentsHubProps) {
  const qc = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
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

  // Fetch accounts to link / display credits
  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts-mini"],
    queryFn: fetchMergedAccounts,
  });

  // Fetch project_accounts
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

  const envs = extractProjectEnvironments(project, projectAccounts, accounts);

  // Form state for configuration modal
  const [form, setForm] = useState<ProjectEnvironmentData>(envs);

  const openConfigModal = () => {
    setForm(extractProjectEnvironments(project, projectAccounts, accounts));
    setIsConfigModalOpen(true);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ProjectEnvironmentData) => {
      return await saveProjectEnvironments({
        projectId: project.id,
        github: data.github,
        googleAiStudio: data.googleAiStudio,
        lovable: data.lovable,
      });
    },
    onSuccess: () => {
      toast.success("Project environments updated");
      setIsConfigModalOpen(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["all-project-accounts"] });
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
      if (onEnvironmentsUpdated) onEnvironmentsUpdated();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update environments"),
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Environments Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold sm:text-base text-foreground">
                Project Environments
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <ShieldCheck className="size-3" /> 3 Configured
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned GitHub main repo, Google AI Studio, and Lovable builder environments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/library/skills"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary hover:border-primary/40"
            title="Browse System Skills & Architecture Specs"
          >
            <BookMarked className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Library SOPs</span>
          </Link>

          <button
            type="button"
            onClick={openConfigModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary hover:border-primary/40 active:scale-95"
          >
            <Edit3 className="size-3.5" /> Configure Environments
          </button>
        </div>
      </div>

      {/* 3 Core Environment Cards Grid */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* 1. GitHub Environment */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-800">
                  <Github className="size-4" />
                </span>
                <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                  GitHub Main Repo
                </span>
              </div>
              <span className="rounded-full bg-neutral-500/10 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">
                main
              </span>
            </div>

            <div className="mt-3.5 space-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Repository Link
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
                    {envs.github.repo_url.replace(/^https?:\/\/github\.com\//, "") ||
                      "Not configured"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(envs.github.repo_url, "gh-url")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy repo URL"
                    >
                      {copiedKey === "gh-url" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {envs.github.repo_url ? (
                      <a
                        href={envs.github.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-primary hover:bg-secondary"
                        title="Open GitHub repo"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Connected Repo Email
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-foreground">
                    <Mail className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{envs.github.email || "No email assigned"}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(envs.github.email, "gh-email")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy email"
                    >
                      {copiedKey === "gh-email" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {envs.github.email ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envs.github.email,
                            label: "GitHub Main Repo",
                          })
                        }
                        className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary/20"
                        title="View or edit email password"
                      >
                        <KeyRound className="size-3" />
                        <span>Password</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">Main codebase & sync</span>
            <button
              type="button"
              onClick={openConfigModal}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Edit Repo
            </button>
          </div>
        </div>

        {/* 2. Google AI Studio Environment */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Cpu className="size-4" />
                </span>
                <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                  Google AI Studio
                </span>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                Connected
              </span>
            </div>

            <div className="mt-3.5 space-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Connected Google Account
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-foreground">
                    <Mail className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {envs.googleAiStudio.email || "No account assigned"}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(envs.googleAiStudio.email, "ai-email")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy Google email"
                    >
                      {copiedKey === "ai-email" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {envs.googleAiStudio.email ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envs.googleAiStudio.email,
                            label: "Google AI Studio",
                          })
                        }
                        className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 transition hover:bg-blue-500/20"
                        title="View or edit email password"
                      >
                        <KeyRound className="size-3" />
                        <span>Password</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  AI Studio Workspace / Prompt
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-[11px] text-foreground">
                    {envs.googleAiStudio.url ? "aistudio.google.com" : "Default workspace"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          envs.googleAiStudio.url || "https://aistudio.google.com",
                          "ai-url",
                        )
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy URL"
                    >
                      {copiedKey === "ai-url" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    <a
                      href={envs.googleAiStudio.url || "https://aistudio.google.com"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-primary hover:bg-secondary"
                      title="Open Google AI Studio"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">Prompting & LLM runtime</span>
            <button
              type="button"
              onClick={openConfigModal}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Switch Account
            </button>
          </div>
        </div>

        {/* 3. Lovable Environment */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                  Lovable Builder
                </span>
              </div>
              {envs.lovable.credits !== null && envs.lovable.credits !== undefined ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Coins className="size-3" />
                  {Number(envs.lovable.credits).toLocaleString()} cr
                </span>
              ) : (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Active
                </span>
              )}
            </div>

            <div className="mt-3.5 space-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Connected Builder Email
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-foreground">
                    <Mail className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{envs.lovable.email || "No email assigned"}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(envs.lovable.email, "lov-email")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy Lovable email"
                    >
                      {copiedKey === "lov-email" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {envs.lovable.email ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPwdModalEmail({
                            open: true,
                            email: envs.lovable.email,
                            accountId: envs.lovable.account_id,
                            label: "Lovable Builder",
                          })
                        }
                        className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary/20"
                        title="View or edit email password"
                      >
                        <KeyRound className="size-3" />
                        <span>Password</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Project Workspace Link
                </p>
                <div className="mt-1 flex items-center justify-between gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-[11px] text-foreground">
                    {envs.lovable.url
                      ? envs.lovable.url.replace(/^https?:\/\//, "")
                      : "lovable.dev"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          envs.lovable.url || `https://lovable.dev/projects/${project.id}`,
                          "lov-url",
                        )
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Copy URL"
                    >
                      {copiedKey === "lov-url" ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {envs.lovable.url ? (
                      <a
                        href={envs.lovable.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-primary hover:bg-secondary"
                        title="Open Lovable builder"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">Full-stack web application</span>
            <button
              type="button"
              onClick={openConfigModal}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Transfer Account
            </button>
          </div>
        </div>
      </div>

      {/* Configure Environments Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Configure Project Environments
                </h3>
                <p className="text-xs text-muted-foreground">
                  Manage the 3 active environments for{" "}
                  <span className="font-semibold text-foreground">{project.project_name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="mt-4 space-y-4"
            >
              {/* Section 1: GitHub Environment */}
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Github className="size-4 text-foreground" />
                  GitHub Main Repository Environment
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Repository URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://github.com/agency/repo"
                      value={form.github.repo_url}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          github: { ...form.github, repo_url: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Main Repo Email *
                      </label>
                      <span className="text-[10px] font-medium text-primary">
                        From builder emails list
                      </span>
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="dev@lovablesolutions.com"
                      value={form.github.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          github: { ...form.github, email: e.target.value },
                        })
                      }
                      list="github-accounts-list"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <datalist id="github-accounts-list">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.email}>
                          {acc.label || acc.email} ({acc.plan || "Pro"})
                        </option>
                      ))}
                    </datalist>

                    {/* Quick selection chips from emails list */}
                    {accounts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Quick pick:</span>
                        {accounts.slice(0, 4).map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                github: { ...form.github, email: acc.email },
                              })
                            }
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                              form.github.email === acc.email
                                ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                                : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {acc.email.split("@")[0]}
                          </button>
                        ))}
                      </div>
                    )}
                    {form.github.email ? (
                      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPwdModalEmail({
                              open: true,
                              email: form.github.email,
                              label: "Main Repo Email",
                            })
                          }
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                        >
                          <KeyRound className="size-3" /> Edit password for {form.github.email}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Section 2: Google AI Studio Environment */}
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Cpu className="size-4 text-blue-600 dark:text-blue-400" />
                  Google AI Studio Environment
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Connected Google Account *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="ai-account@agency.com"
                      value={form.googleAiStudio.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          googleAiStudio: { ...form.googleAiStudio, email: e.target.value },
                        })
                      }
                      list="ai-accounts-list"
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <datalist id="ai-accounts-list">
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.email} />
                      ))}
                    </datalist>
                    {form.googleAiStudio.email ? (
                      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPwdModalEmail({
                              open: true,
                              email: form.googleAiStudio.email,
                              label: "Google AI Studio",
                            })
                          }
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 transition hover:underline"
                        >
                          <KeyRound className="size-3" /> Edit password for{" "}
                          {form.googleAiStudio.email}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Prompt / Workspace URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://aistudio.google.com"
                      value={form.googleAiStudio.url || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          googleAiStudio: { ...form.googleAiStudio, url: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Lovable Environment */}
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Lovable Builder Environment
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Connected Builder Email *
                    </label>
                    <select
                      value={form.lovable.email}
                      onChange={(e) => {
                        const selectedAcc = accounts.find((a) => a.email === e.target.value);
                        setForm({
                          ...form,
                          lovable: {
                            ...form.lovable,
                            email: e.target.value,
                            account_id: selectedAcc?.id,
                            credits: selectedAcc?.credits_remaining,
                          },
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.email}>
                          {acc.email} ({Number(acc.credits_remaining ?? 0).toLocaleString()} cr)
                        </option>
                      ))}
                      {!accounts.some((a) => a.email === form.lovable.email) &&
                      form.lovable.email ? (
                        <option value={form.lovable.email}>{form.lovable.email} (Custom)</option>
                      ) : null}
                    </select>
                    {form.lovable.email ? (
                      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPwdModalEmail({
                              open: true,
                              email: form.lovable.email,
                              accountId: form.lovable.account_id,
                              label: "Lovable Builder",
                            })
                          }
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                        >
                          <KeyRound className="size-3" /> Edit password for {form.lovable.email}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Project / App URL
                    </label>
                    <input
                      type="url"
                      placeholder={`https://${project.project_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.lovable.app`}
                      value={form.lovable.url || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lovable: { ...form.lovable, url: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="gradient-leaf rounded-xl px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving Environments…" : "Save All Environments"}
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
        accountId={pwdModalEmail.accountId}
        label={pwdModalEmail.label}
      />
    </div>
  );
}
