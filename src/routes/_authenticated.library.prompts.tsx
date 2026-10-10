import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Sparkles,
  Terminal,
  Copy,
  Check,
  Plus,
  Upload,
  Download,
  Trash2,
  X,
  Tag,
  Cpu,
  Variable,
  Layers,
  FileText,
  SlidersHorizontal,
  Pencil,
  RotateCcw,
  FolderGit2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { LIBRARY_TABS } from "@/routes/_authenticated.library";
import { Pill } from "@/components/dash";
import { SearchInput } from "@/components/search";
import {
  LibraryTextPrompt,
  getLocalPrompts,
  upsertPrompt,
  deletePrompt,
} from "@/lib/library-store";
import { LibraryToolbar } from "@/components/LibraryToolbar";
import { onDbSync } from "@/lib/database-interconnect";
import { fetchMergedProjects, PipelineProject } from "@/lib/pipeline-store";
import { CategoryDropdown } from "@/components/CategoryDropdown";

export const Route = createFileRoute("/_authenticated/library/prompts")({
  head: () => ({
    meta: [
      { title: "Text Prompts — Lovable Solutions" },
      {
        name: "description",
        content:
          "Curated AI text prompts, dashboard blueprints, system directives, and generation recipes.",
      },
    ],
  }),
  component: TextPromptsPage,
});

const CATEGORIES = [
  "All",
  "Dashboard Layouts",
  "KPI & Metric Visualizations",
  "Glassmorphic & Theming",
  "Full-Stack Server Functions",
  "Client Onboarding & Emails",
  "Security & Auth",
  "Bug Fixing & Refactoring",
] as const;

const ENGINES = [
  "All",
  "Lovable AI",
  "Google AI Studio / Gemini",
  "Claude 3.7",
  "Universal",
] as const;

export function TextPromptsPage() {
  const [prompts, setPrompts] = useState<LibraryTextPrompt[]>(() => getLocalPrompts());
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedEngine, setSelectedEngine] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Projects list for quick variables auto-injector
  const [projects, setProjects] = useState<PipelineProject[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [activePromptDetail, setActivePromptDetail] = useState<LibraryTextPrompt | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] =
    useState<LibraryTextPrompt["category"]>("Dashboard Layouts");
  const [formDesc, setFormDesc] = useState("");
  const [formPromptText, setFormPromptText] = useState("");
  const [formEngine, setFormEngine] = useState<LibraryTextPrompt["targetEngine"]>("Lovable AI");
  const [formVariables, setFormVariables] = useState("");
  const [formTags, setFormTags] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variable test replacement state for active modal
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({});

  const refreshPrompts = () => {
    setPrompts(getLocalPrompts());
  };

  useEffect(() => {
    // Load projects for auto-fill
    fetchMergedProjects()
      .then((p) => setProjects(p))
      .catch(() => {});

    const unsub = onDbSync((e) => {
      if (e.type === "library_prompt_updated" || e.type === "library_synced") {
        refreshPrompts();
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes("agency_library")) {
        refreshPrompts();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const openNewPromptModal = () => {
    setEditingPromptId(null);
    setFormTitle("");
    setFormCategory("Dashboard Layouts");
    setFormDesc("");
    setFormPromptText("");
    setFormEngine("Lovable AI");
    setFormVariables("");
    setFormTags("");
    setIsModalOpen(true);
  };

  const openEditPromptModal = (item: LibraryTextPrompt) => {
    setEditingPromptId(item.id);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormDesc(item.description || "");
    setFormPromptText(item.promptText || "");
    setFormEngine(item.targetEngine || "Lovable AI");
    setFormVariables(item.variables?.join(", ") || "");
    setFormTags(item.tags?.join(", ") || "");
    setIsModalOpen(true);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Prompt copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyResolved = (prompt: LibraryTextPrompt) => {
    let resolved = prompt.promptText;
    if (prompt.variables) {
      for (const v of prompt.variables) {
        const val = variableInputs[v];
        if (val) {
          resolved = resolved.replaceAll(`{{${v}}}`, val);
        }
      }
    }
    navigator.clipboard.writeText(resolved);
    setCopiedId(prompt.id);
    toast.success("Prompt with filled variables copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (prompt: LibraryTextPrompt) => {
    let text = prompt.promptText;
    if (prompt.variables) {
      for (const v of prompt.variables) {
        const val = variableInputs[v];
        if (val) {
          text = text.replaceAll(`{{${v}}}`, val);
        }
      }
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prompt.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.prompt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${prompt.title}.prompt`);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete prompt "${title}"?`)) {
      const updated = deletePrompt(id);
      setPrompts(updated);
      if (activePromptDetail?.id === id) setActivePromptDetail(null);
      toast.success("Prompt deleted");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFormPromptText(text || "");
      // Detect {{variable}} pattern
      const matches = Array.from(text.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map((m) => m[1]);
      if (matches.length > 0) {
        setFormVariables(Array.from(new Set(matches)).join(", "));
      }
      toast.success(`Prompt loaded from ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleSavePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!formPromptText.trim()) {
      toast.error("Please enter prompt text");
      return;
    }

    const manualVars = formVariables
      ? formVariables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const detectedVars = Array.from(formPromptText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map(
      (m) => m[1],
    );
    const combinedVars = Array.from(new Set([...manualVars, ...detectedVars]));

    const isEditing = Boolean(editingPromptId);
    const targetId = editingPromptId || `prompt-custom-${Date.now()}`;

    const promptPayload: LibraryTextPrompt = {
      id: targetId,
      title: formTitle.trim(),
      category: formCategory,
      description: formDesc.trim() || `AI Prompt for ${formCategory}.`,
      promptText: formPromptText.trim(),
      targetEngine: formEngine,
      variables: combinedVars.length > 0 ? combinedVars : undefined,
      tags: formTags
        ? formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [formCategory, "Prompt"],
      author: isEditing
        ? prompts.find((p) => p.id === targetId)?.author || "Agency Builder"
        : "Agency Builder",
      created_at: isEditing
        ? prompts.find((p) => p.id === targetId)?.created_at || new Date().toISOString()
        : new Date().toISOString(),
    };

    const updated = upsertPrompt(promptPayload);
    setPrompts(updated);
    if (activePromptDetail?.id === targetId) {
      setActivePromptDetail(promptPayload);
    }
    toast.success(
      isEditing
        ? `Prompt "${promptPayload.title}" updated!`
        : `Prompt "${promptPayload.title}" saved to library!`,
    );

    setIsModalOpen(false);
  };

  // Handle autofilling variables from active project
  const handleAutofillFromProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    setVariableInputs((prev) => ({
      ...prev,
      client_name: proj.project_name,
      project_name: proj.project_name,
      primary_kpis: "MRR, Pipeline Velocity, Shipped Apps, Active Builders",
      theme_accent: "emerald (#10b981)",
      brand_color: "#10b981",
      font_display: "Plus Jakarta Sans",
      stages: "Planning, Building, Testing, Shipped",
      platforms: "GitHub Repository, Lovable Workspace, Google AI Studio",
      action_name: `update_${proj.project_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      table_name: "projects",
      input_schema: "{ projectId: string, stage: string, notes?: string }",
      total_amount: "$15,000",
      months_prepaid: "3",
      error_symptom: "Data cache desync on rapid stage advancement",
      affected_components: "BuildPipelineSection.tsx, ProjectEnvironmentsHub.tsx",
    }));

    toast.success(`Autofilled variables from project "${proj.project_name}"!`);
  };

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase()) ||
        p.promptText.toLowerCase().includes(q.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()));

      const matchesCat = selectedCategory === "All" || p.category === selectedCategory;
      const matchesEngine = selectedEngine === "All" || p.targetEngine === selectedEngine;

      return matchesSearch && matchesCat && matchesEngine;
    });
  }, [prompts, q, selectedCategory, selectedEngine]);

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
        count: cat === "All" ? prompts.length : prompts.filter((p) => p.category === cat).length,
      })),
    [prompts],
  );

  return (
    <AppShell
      title="Library: Text Prompts"
      subtitle="Engineered AI prompts, dashboard recipes, system instructions, and generation patterns."
      actions={
        <button
          type="button"
          onClick={openNewPromptModal}
          className="inline-flex items-center gap-2 rounded-xl gradient-leaf px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition"
        >
          <Plus className="size-3.5" />
          <span>Add Text Prompt</span>
        </button>
      }
    >
      <SubTabs tabs={LIBRARY_TABS} />

      {/* Unified Library Toolbar */}
      <LibraryToolbar
        onSync={refreshPrompts}
        onAddNew={openNewPromptModal}
        addNewLabel="New Prompt"
      />

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryDropdown
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categoryOptions}
            label="Category"
          />

          {/* Target Engine Dropdown */}
          <select
            value={selectedEngine}
            onChange={(e) => setSelectedEngine(e.target.value)}
            className="h-9 rounded-xl border border-input bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          >
            {ENGINES.map((eng) => (
              <option key={eng} value={eng}>
                Engine: {eng}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <SearchInput value={q} onChange={setQ} placeholder="Search prompts by keyword…" />
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Terminal className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill tone="leaf">{item.category}</Pill>
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/80">
                        <Cpu className="size-2.5 text-primary" />
                        {item.targetEngine}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditPromptModal(item)}
                    title="Edit prompt"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    title="Download .prompt file"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.title)}
                    title="Delete prompt"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {item.description}
              </p>

              {/* Variables preview */}
              {item.variables && item.variables.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Variables:
                  </span>
                  {item.variables.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-primary"
                    >
                      <Variable className="size-2.5" />
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Prompt Snippet Box */}
              <div className="relative mt-4 rounded-xl border border-border/60 bg-secondary/30 p-3">
                <pre className="font-mono text-xs max-h-36 overflow-hidden text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {item.promptText.slice(0, 320)}
                  {item.promptText.length > 320 && "…"}
                </pre>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card via-card/70 to-transparent" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={() => {
                  setActivePromptDetail(item);
                  const initVars: Record<string, string> = {};
                  item.variables?.forEach((v) => {
                    initVars[v] = "";
                  });
                  setVariableInputs(initVars);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Expand & Test Variables →
              </button>

              <button
                type="button"
                onClick={() => handleCopy(item.promptText, item.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary transition"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
            <Terminal className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 font-display text-sm font-semibold text-foreground">
              No prompts match your filter
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a custom prompt or import from a prompt file (.txt, .md).
            </p>
            <button
              type="button"
              onClick={openNewPromptModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg gradient-leaf px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="size-3.5" />
              <span>Add Text Prompt</span>
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Prompt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {editingPromptId ? "Edit AI Text Prompt" : "Add AI Text Prompt"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Store engineered prompts with variables like {"{{variable_name}}"} for rapid
                  generation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrompt} className="mt-5 space-y-4">
              {/* Optional File Import */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3 text-center transition hover:border-primary/60 hover:bg-secondary/50"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.prompt"
                  className="hidden"
                />
                <p className="text-xs font-medium text-foreground flex items-center justify-center gap-1.5">
                  <Upload className="size-3.5 text-primary" />
                  <span>Optional: Upload .txt, .md, or .prompt file</span>
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Prompt Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Executive KPI Bento Prompt"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as LibraryTextPrompt["category"])
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  >
                    <option value="Dashboard Layouts">Dashboard Layouts</option>
                    <option value="KPI & Metric Visualizations">KPI & Metric Visualizations</option>
                    <option value="Glassmorphic & Theming">Glassmorphic & Theming</option>
                    <option value="Full-Stack Server Functions">Full-Stack Server Functions</option>
                    <option value="Client Onboarding & Emails">Client Onboarding & Emails</option>
                    <option value="Security & Auth">Security & Auth</option>
                    <option value="Bug Fixing & Refactoring">Bug Fixing & Refactoring</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Target AI Engine</label>
                  <select
                    value={formEngine}
                    onChange={(e) =>
                      setFormEngine(e.target.value as LibraryTextPrompt["targetEngine"])
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  >
                    <option value="Lovable AI">Lovable AI</option>
                    <option value="Google AI Studio / Gemini">Google AI Studio / Gemini</option>
                    <option value="Claude 3.7">Claude 3.7</option>
                    <option value="Universal">Universal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Variables (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formVariables}
                    onChange={(e) => setFormVariables(e.target.value)}
                    placeholder="client_name, date_range, metric"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Short Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What is this prompt best used for?"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Bento, Recharts, API, Clean"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Prompt Text *</label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Use {"{{variable_name}}"} for dynamic inputs
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={formPromptText}
                  onChange={(e) => setFormPromptText(e.target.value)}
                  placeholder="Write the full AI prompt here…"
                  className="mt-1 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl gradient-leaf px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95"
                >
                  {editingPromptId ? "Update Prompt" : "Save Prompt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expand / Test Variables Modal */}
      {activePromptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Pill tone="leaf">{activePromptDetail.category}</Pill>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    {activePromptDetail.targetEngine}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                  {activePromptDetail.title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = activePromptDetail;
                    setActivePromptDetail(null);
                    openEditPromptModal(toEdit);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary text-foreground transition"
                >
                  <Pencil className="size-3 text-primary" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePromptDetail(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {activePromptDetail.description}
            </p>

            {/* Quick Autofill from Project Dropdown */}
            {projects.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/30 px-3 py-2">
                <FolderGit2 className="size-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground shrink-0">
                  Autofill from Project:
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleAutofillFromProject(e.target.value);
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    Select an active project to inject variables…
                  </option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.project_name} ({proj.client_business_name || "Client"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If has variables, interactive fill inputs */}
            {activePromptDetail.variables && activePromptDetail.variables.length > 0 && (
              <div className="mt-4 rounded-xl border border-border/80 bg-secondary/40 p-4">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <span>Customize Prompt Variables:</span>
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {activePromptDetail.variables.map((v) => (
                    <div key={v}>
                      <label className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {`{{${v}}}`}
                      </label>
                      <input
                        type="text"
                        value={variableInputs[v] || ""}
                        onChange={(e) =>
                          setVariableInputs((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        placeholder={`Fill value for ${v}…`}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Text Box */}
            <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-4">
              <pre className="font-mono text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed overflow-x-auto">
                {activePromptDetail.promptText}
              </pre>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(activePromptDetail.promptText, activePromptDetail.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Raw Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(activePromptDetail)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Download className="size-3.5" />
                  <span>Download .prompt</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopyResolved(activePromptDetail)}
                className="inline-flex items-center gap-1.5 rounded-lg gradient-leaf px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95"
              >
                {copiedId === activePromptDetail.id ? (
                  <>
                    <Check className="size-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>Copy with Filled Variables</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
