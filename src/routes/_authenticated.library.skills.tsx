import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  BookMarked,
  Sparkles,
  Copy,
  Check,
  Plus,
  Upload,
  Download,
  Trash2,
  Tag,
  Cpu,
  Layers,
  FileText,
  X,
  ExternalLink,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { LIBRARY_TABS } from "@/routes/_authenticated.library";
import { Pill } from "@/components/dash";
import { SearchInput } from "@/components/search";
import {
  LibrarySkill,
  getLocalSkills,
  upsertSkill,
  deleteSkill,
  syncLibraryFromDb,
  initLibraryRealtime,
} from "@/lib/library-store";
import { LibraryToolbar } from "@/components/LibraryToolbar";
import { onDbSync } from "@/lib/database-interconnect";
import { CategoryDropdown } from "@/components/CategoryDropdown";

export const Route = createFileRoute("/_authenticated/library/skills")({
  head: () => ({
    meta: [
      { title: "Skills & System Specs — Lovable Solutions" },
      {
        name: "description",
        content:
          "System skills, agent SOPs, frontend design constitutions, and uploaded engineering blueprints.",
      },
    ],
  }),
  component: SkillsPage,
});

const CATEGORIES = [
  "All",
  "Operations",
  "Engineering",
  "Frontend Design",
  "AI & Prompts",
  "Security",
  "Finance",
  "Database & APIs",
] as const;

export function SkillsPage() {
  const [skills, setSkills] = useState<LibrarySkill[]>(() => getLocalSkills());
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [previewSkill, setPreviewSkill] = useState<LibrarySkill | null>(null);

  // Form states for Upload / Edit Skill
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<LibrarySkill["category"]>("Frontend Design");
  const [formDesc, setFormDesc] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formModel, setFormModel] = useState("Universal");
  const [formAuthor, setFormAuthor] = useState("");
  const [formVersion, setFormVersion] = useState("1.0");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSkills = () => {
    setSkills(getLocalSkills());
  };

  // Subscribe to real-time interconnect and cross-tab storage sync
  useEffect(() => {
    void syncLibraryFromDb();
    const cleanupRealtime = initLibraryRealtime();
    const unsub = onDbSync((e) => {
      if (e.type === "library_skill_updated" || e.type === "library_synced") {
        refreshSkills();
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes("agency_library")) {
        refreshSkills();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      cleanupRealtime();
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const openNewSkillModal = () => {
    setEditingSkillId(null);
    setFormTitle("");
    setFormCategory("Frontend Design");
    setFormDesc("");
    setFormContent("");
    setFormTags("");
    setFormModel("Universal");
    setFormAuthor("Agency Engineer");
    setFormVersion("1.0");
    setUploadFileName(null);
    setIsModalOpen(true);
  };

  const openEditSkillModal = (skill: LibrarySkill) => {
    setEditingSkillId(skill.id);
    setFormTitle(skill.title);
    setFormCategory(skill.category);
    setFormDesc(skill.description || "");
    setFormContent(skill.content || "");
    setFormTags(skill.tags?.join(", ") || "");
    setFormModel(skill.target_models?.[0] || "Universal");
    setFormAuthor(skill.author || "Agency Engineer");
    setFormVersion(skill.version || "1.0");
    setUploadFileName(skill.source_file_name || null);
    setIsModalOpen(true);
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Skill content copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (skill: LibrarySkill) => {
    const blob = new Blob([skill.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skill.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${skill.title}.md`);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete the skill "${title}"?`)) {
      const updated = deleteSkill(id);
      setSkills(updated);
      if (previewSkill?.id === id) setPreviewSkill(null);
      toast.success("Skill removed from library");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    // Suggest title from file name if blank
    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFormContent(text || "");

      // Smart YAML frontmatter parser for SKILL.md and documentation
      if (text.startsWith("---")) {
        const fmEnd = text.indexOf("---", 3);
        if (fmEnd > 3) {
          const fm = text.slice(3, fmEnd);
          const nameMatch = fm.match(/(?:name|title):\s*([^\n\r]+)/i);
          if (nameMatch && nameMatch[1]) {
            setFormTitle(nameMatch[1].replace(/["']/g, "").trim());
          }
          const descMatch = fm.match(/description:\s*([^\n\r]+)/i);
          if (descMatch && descMatch[1]) {
            setFormDesc(descMatch[1].replace(/["']/g, "").trim());
          }
          const catMatch = fm.match(/category:\s*([^\n\r]+)/i);
          if (catMatch && catMatch[1]) {
            const rawCat = catMatch[1].replace(/["']/g, "").trim();
            if (CATEGORIES.includes(rawCat as (typeof CATEGORIES)[number])) {
              setFormCategory(rawCat as LibrarySkill["category"]);
            }
          }
          const tagMatch = fm.match(/tags:\s*\[?([^\n\r\]]+)\]?/i);
          if (tagMatch && tagMatch[1]) {
            setFormTags(tagMatch[1].replace(/["']/g, "").trim());
          }
        }
      }

      if (!formDesc) {
        const firstLine = text
          .split("\n")
          .find((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("---"));
        if (firstLine) {
          setFormDesc(firstLine.slice(0, 140));
        }
      }
      toast.success(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleSaveSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a skill title");
      return;
    }
    if (!formContent.trim()) {
      toast.error("Please provide skill content or upload a file");
      return;
    }

    const isEditing = Boolean(editingSkillId);
    const targetId = editingSkillId || crypto.randomUUID();

    const skillPayload: LibrarySkill = {
      id: targetId,
      title: formTitle.trim(),
      category: formCategory,
      description: formDesc.trim() || `Skill specification for ${formCategory}.`,
      content: formContent.trim(),
      tags: formTags
        ? formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [formCategory, "Custom"],
      target_models: formModel ? [formModel.trim()] : ["Universal"],
      author: formAuthor.trim() || "Agency Engineer",
      version: formVersion.trim() || "1.0",
      created_at: isEditing
        ? skills.find((s) => s.id === targetId)?.created_at || new Date().toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_file_name: uploadFileName || undefined,
    };

    const updated = upsertSkill(skillPayload);
    setSkills(updated);
    if (previewSkill?.id === targetId) {
      setPreviewSkill(skillPayload);
    }

    toast.success(
      isEditing
        ? `Skill "${skillPayload.title}" updated!`
        : `Skill "${skillPayload.title}" added to library!`,
    );

    setIsModalOpen(false);
  };

  const filtered = useMemo(() => {
    return skills.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(q.toLowerCase()) ||
        item.category.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()));

      const matchesCat = selectedCategory === "All" || item.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [skills, q, selectedCategory]);

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
        count: cat === "All" ? skills.length : skills.filter((s) => s.category === cat).length,
      })),
    [skills],
  );

  return (
    <AppShell
      title="Library: Skills & Knowledge"
      subtitle="Standard operating procedures, prompt blueprints, frontend constitutions, and system skills."
      actions={
        <button
          type="button"
          onClick={openNewSkillModal}
          className="inline-flex items-center gap-2 rounded-xl gradient-leaf px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition"
        >
          <Upload className="size-3.5" />
          <span>Upload / Create Skill</span>
        </button>
      }
    >
      <SubTabs tabs={LIBRARY_TABS} />

      {/* Library Toolbar with export, import, reset */}
      <LibraryToolbar onSync={refreshSkills} onAddNew={openNewSkillModal} addNewLabel="New Skill" />

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryDropdown
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
          label="Category"
        />

        <div className="w-full sm:w-72">
          <SearchInput value={q} onChange={setQ} placeholder="Search skills, tags, guides…" />
        </div>
      </div>

      {/* Skills Grid */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookMarked className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill tone="leaf">{item.category}</Pill>
                      {item.version && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          v{item.version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditSkillModal(item)}
                    title="Edit skill specification"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    title="Download .md file"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.title)}
                    title="Delete skill"
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

              {/* Tag Pills */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary/70 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                  >
                    <Tag className="size-2.5 text-muted-foreground" />
                    {tag}
                  </span>
                ))}
                {item.target_models?.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                  >
                    <Cpu className="size-2.5" />
                    {model}
                  </span>
                ))}
              </div>

              {/* Code/Spec Snippet Box */}
              <div className="relative mt-4 rounded-xl border border-border/60 bg-secondary/30 p-3">
                <pre className="font-mono text-xs max-h-36 overflow-hidden text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {item.content.slice(0, 320)}
                  {item.content.length > 320 && "…"}
                </pre>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card via-card/70 to-transparent" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={() => setPreviewSkill(item)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View Full Skill Spec →
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(item.content, item.id)}
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
                      <span>Copy Spec</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
            <BookMarked className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 font-display text-sm font-semibold text-foreground">
              No skills found
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search query or upload a new skill document.
            </p>
            <button
              type="button"
              onClick={openNewSkillModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg gradient-leaf px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Upload className="size-3.5" />
              <span>Upload Skill Document</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload / Edit Skill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {editingSkillId ? "Edit Skill Specification" : "Upload Skill or SOP Document"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Import markdown files (.md), prompt patterns, or system guidelines into the agency
                  library.
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

            <form onSubmit={handleSaveSkill} className="mt-5 space-y-4">
              {/* File Drop / Select Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border/80 bg-secondary/30 p-4 text-center transition hover:border-primary/60 hover:bg-secondary/50"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".md,.txt,.json,.ts,.tsx"
                  className="hidden"
                />
                <Upload className="mx-auto size-6 text-primary/80" />
                <p className="mt-1.5 text-xs font-semibold text-foreground">
                  {uploadFileName ? (
                    <span className="text-emerald-500 font-bold">Loaded: {uploadFileName}</span>
                  ) : (
                    "Click to upload or replace file (.md, .txt, .json)"
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  File content will automatically populate the markdown field below.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Skill Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Supabase Edge Functions Guide"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as LibrarySkill["category"])}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  >
                    <option value="Frontend Design">Frontend Design</option>
                    <option value="Engineering">Engineering</option>
                    <option value="AI & Prompts">AI & Prompts</option>
                    <option value="Operations">Operations</option>
                    <option value="Security">Security</option>
                    <option value="Finance">Finance</option>
                    <option value="Database & APIs">Database & APIs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Short Summary</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="One or two sentences describing when to apply this skill"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Target Model / Agent
                  </label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="e.g. Gemini 2.5 Pro, Lovable AI"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Author / Team</label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g. Lead Architect"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Version</label>
                  <input
                    type="text"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="e.g. 1.2"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="e.g. UI/UX, Tailwind, Edge Functions"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Content & Code / Markdown *
                  </label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Markdown supported
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Paste rules, markdown documentation, or code snippets here…"
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
                  {editingSkillId ? "Update Skill" : "Save Skill to Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Full Skill Modal */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Pill tone="leaf">{previewSkill.category}</Pill>
                  {previewSkill.version && (
                    <span className="font-mono text-xs text-muted-foreground">
                      v{previewSkill.version}
                    </span>
                  )}
                  {previewSkill.author && (
                    <span className="text-xs text-muted-foreground">by {previewSkill.author}</span>
                  )}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                  {previewSkill.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = previewSkill;
                    setPreviewSkill(null);
                    openEditSkillModal(toEdit);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary text-foreground transition"
                >
                  <Pencil className="size-3 text-primary" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSkill(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {previewSkill.description}
            </p>

            <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-4">
              <pre className="font-mono text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed overflow-x-auto">
                {previewSkill.content}
              </pre>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={() => handleDownload(previewSkill)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Download className="size-3.5" />
                <span>Download .md</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(previewSkill.content, previewSkill.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg gradient-leaf px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {copiedId === previewSkill.id ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Full Content</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
