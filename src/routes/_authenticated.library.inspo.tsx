import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Image as ImageIcon,
  Sparkles,
  Upload,
  Download,
  Copy,
  Check,
  Maximize2,
  Trash2,
  X,
  Tag,
  Palette,
  Terminal,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { LIBRARY_TABS } from "@/routes/_authenticated.library";
import { Pill } from "@/components/dash";
import { SearchInput } from "@/components/search";
import { DashboardInspo, getLocalInspo, upsertInspo, deleteInspo } from "@/lib/library-store";
import { LibraryToolbar } from "@/components/LibraryToolbar";
import { onDbSync } from "@/lib/database-interconnect";
import { CategoryDropdown } from "@/components/CategoryDropdown";

export const Route = createFileRoute("/_authenticated/library/inspo")({
  head: () => ({
    meta: [
      { title: "Dashboard Inspo — Lovable Solutions" },
      {
        name: "description",
        content:
          "Curated dashboard inspirations, dark-mode layouts, bento grids, and prompt recipes.",
      },
    ],
  }),
  component: DashboardInspoPage,
});

const CATEGORIES = [
  "All",
  "Executive SaaS",
  "Dark Glassmorphism",
  "Analytics & BI",
  "Fintech & Payments",
  "Kanban & Pipelines",
  "Mobile & Responsive",
  "Minimalist Clean",
] as const;

export function DashboardInspoPage() {
  const [inspoItems, setInspoItems] = useState<DashboardInspo[]>(() => getLocalInspo());
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lightbox / Modal preview
  const [lightboxItem, setLightboxItem] = useState<DashboardInspo | null>(null);

  // Upload & Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspoId, setEditingInspoId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<DashboardInspo["category"]>("Executive SaaS");
  const [formDesc, setFormDesc] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formStyleNotes, setFormStyleNotes] = useState("");
  const [formPromptRecipe, setFormPromptRecipe] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshInspo = () => {
    setInspoItems(getLocalInspo());
  };

  useEffect(() => {
    const unsub = onDbSync((e) => {
      if (e.type === "library_inspo_updated" || e.type === "library_synced") {
        refreshInspo();
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes("agency_library")) {
        refreshInspo();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const openNewInspoModal = () => {
    setEditingInspoId(null);
    setFormTitle("");
    setFormCategory("Executive SaaS");
    setFormDesc("");
    setFormImageUrl("");
    setFormTags("");
    setFormStyleNotes("");
    setFormPromptRecipe("");
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEditInspoModal = (item: DashboardInspo) => {
    setEditingInspoId(item.id);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormDesc(item.description || "");
    setFormImageUrl(item.imageUrl.startsWith("data:") ? "" : item.imageUrl);
    setImagePreview(item.imageUrl);
    setFormTags(item.tags?.join(", ") || "");
    setFormStyleNotes(item.styleNotes || "");
    setFormPromptRecipe(item.promptRecipe || "");
    setIsModalOpen(true);
  };

  const handleCopyPrompt = (recipe: string, id: string) => {
    navigator.clipboard.writeText(recipe);
    setCopiedId(id);
    toast.success("AI prompt recipe copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (item: DashboardInspo) => {
    const a = document.createElement("a");
    a.href = item.imageUrl;
    a.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-inspo.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${item.title}`);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete inspiration "${title}"?`)) {
      const updated = deleteInspo(id);
      setInspoItems(updated);
      if (lightboxItem?.id === id) setLightboxItem(null);
      toast.success("Inspiration removed");
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formTitle) {
      const clean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormTitle(clean.charAt(0).toUpperCase() + clean.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      toast.success("Image file loaded!");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInspo = (e: React.FormEvent) => {
    e.preventDefault();
    const finalImage = imagePreview || formImageUrl.trim();
    if (!formTitle.trim()) {
      toast.error("Please enter a title for the inspiration");
      return;
    }
    if (!finalImage) {
      toast.error("Please provide an image file or URL");
      return;
    }

    const isEditing = Boolean(editingInspoId);
    const targetId = editingInspoId || `inspo-custom-${Date.now()}`;

    const itemPayload: DashboardInspo = {
      id: targetId,
      title: formTitle.trim(),
      category: formCategory,
      description: formDesc.trim() || `Design inspiration for ${formCategory}.`,
      imageUrl: finalImage,
      tags: formTags
        ? formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [formCategory, "Dashboard"],
      styleNotes: formStyleNotes.trim() || "Dark mode, modern glass surfaces and responsive grids.",
      promptRecipe:
        formPromptRecipe.trim() ||
        `Design a modern ${formCategory} dashboard in Tailwind CSS with dark slate theme and high-density metric cards.`,
      author: isEditing
        ? inspoItems.find((i) => i.id === targetId)?.author || "Agency Builder"
        : "Agency Builder",
      created_at: isEditing
        ? inspoItems.find((i) => i.id === targetId)?.created_at || new Date().toISOString()
        : new Date().toISOString(),
    };

    const updated = upsertInspo(itemPayload);
    setInspoItems(updated);
    if (lightboxItem?.id === targetId) {
      setLightboxItem(itemPayload);
    }
    toast.success(
      isEditing
        ? `Inspiration "${itemPayload.title}" updated!`
        : `Inspiration "${itemPayload.title}" added to library!`,
    );

    setIsModalOpen(false);
  };

  const filtered = useMemo(() => {
    return inspoItems.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())) ||
        item.styleNotes.toLowerCase().includes(q.toLowerCase());

      const matchesCat = selectedCategory === "All" || item.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [inspoItems, q, selectedCategory]);

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        value: cat,
        label: cat,
        count:
          cat === "All" ? inspoItems.length : inspoItems.filter((i) => i.category === cat).length,
      })),
    [inspoItems],
  );

  return (
    <AppShell
      title="Library: Dashboard Inspo"
      subtitle="Visual dashboard inspirations, UI mockups, dark theme concepts, and AI prompt recipes."
      actions={
        <button
          type="button"
          onClick={openNewInspoModal}
          className="inline-flex items-center gap-2 rounded-xl gradient-leaf px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition"
        >
          <Upload className="size-3.5" />
          <span>Upload / Create Inspo</span>
        </button>
      }
    >
      <SubTabs tabs={LIBRARY_TABS} />

      {/* Unified Library Toolbar */}
      <LibraryToolbar
        onSync={refreshInspo}
        onAddNew={openNewInspoModal}
        addNewLabel="Upload Inspo"
      />

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryDropdown
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
          label="Category"
        />

        <div className="w-full sm:w-72">
          <SearchInput value={q} onChange={setQ} placeholder="Search inspo by title, tag, style…" />
        </div>
      </div>

      {/* Inspo Cards Grid */}
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition hover:border-primary/40 hover:shadow-lg"
          >
            {/* Visual Thumbnail with Overlay */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950/80 border-b border-border/60">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition group-hover:opacity-40" />

              {/* Top overlay badges */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md border border-white/10">
                  {item.category}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditInspoModal(item)}
                    title="Edit inspiration"
                    className="flex size-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md hover:bg-black/80 border border-white/10 transition"
                  >
                    <Pencil className="size-3.5 text-primary" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxItem(item)}
                    title="Fullscreen zoom"
                    className="flex size-7 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md hover:bg-black/80 border border-white/10 transition"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.title)}
                    title="Delete"
                    className="flex size-7 items-center justify-center rounded-lg bg-red-950/60 text-red-200 backdrop-blur-md hover:bg-red-900 border border-red-500/20 transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inspo Card Content */}
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                {/* Style Notes */}
                {item.styleNotes && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/40 p-2.5 text-xs text-foreground/80 border border-border/40">
                    <Palette className="size-3.5 shrink-0 text-primary mt-0.5" />
                    <p className="text-[11px] leading-relaxed line-clamp-2">
                      <span className="font-semibold text-foreground">Style:</span>{" "}
                      {item.styleNotes}
                    </p>
                  </div>
                )}

                {/* Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                    >
                      <Tag className="size-2.5 text-muted-foreground" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => setLightboxItem(item)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View Details & Lightbox →
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    title="Download mockup image"
                    className="flex size-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(item.promptRecipe, item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary transition"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="size-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Prompt Copied!</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 text-primary" />
                        <span>Copy AI Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
            <ImageIcon className="mx-auto size-8 text-muted-foreground/60" />
            <h4 className="mt-3 font-display text-sm font-semibold text-foreground">
              No inspiration cards match your filter
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload dashboard screenshots, Figma mockups, or design inspiration images.
            </p>
            <button
              type="button"
              onClick={openNewInspoModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg gradient-leaf px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Upload className="size-3.5" />
              <span>Upload Dashboard Inspo</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {editingInspoId ? "Edit Dashboard Inspiration" : "Upload Dashboard Inspiration"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Store dashboard mockups, UI screenshots, style notes, and the prompt used to
                  create them.
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

            <form onSubmit={handleSaveInspo} className="mt-5 space-y-4">
              {/* Image Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border/80 bg-secondary/30 p-5 text-center transition hover:border-primary/60 hover:bg-secondary/50"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFile}
                  accept="image/*"
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="mx-auto max-h-48 rounded-lg object-contain shadow-xs border border-border/50"
                    />
                    <p className="text-xs font-semibold text-emerald-500">
                      ✓ Image loaded. Click to replace or browse another file.
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto size-7 text-primary/80" />
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      Click to browse or drop an image file (PNG, JPG, SVG, WebP)
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Stored in high-resolution for instant gallery access.
                    </p>
                  </div>
                )}
              </div>

              {/* Or image URL */}
              <div>
                <label className="text-xs font-semibold text-foreground">Or Paste Image URL</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => {
                    setFormImageUrl(e.target.value);
                    if (e.target.value.startsWith("http")) setImagePreview(e.target.value);
                  }}
                  placeholder="https://images.unsplash.com/... or data:image/..."
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Dark Glassmorphic Fintech Dashboard"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as DashboardInspo["category"])}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  >
                    <option value="Executive SaaS">Executive SaaS</option>
                    <option value="Dark Glassmorphism">Dark Glassmorphism</option>
                    <option value="Analytics & BI">Analytics & BI</option>
                    <option value="Fintech & Payments">Fintech & Payments</option>
                    <option value="Kanban & Pipelines">Kanban & Pipelines</option>
                    <option value="Mobile & Responsive">Mobile & Responsive</option>
                    <option value="Minimalist Clean">Minimalist Clean</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Short description of the UX patterns and value"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Style & Color Notes
                  </label>
                  <input
                    type="text"
                    value={formStyleNotes}
                    onChange={(e) => setFormStyleNotes(e.target.value)}
                    placeholder="e.g. Dark slate-950, emerald accent, frosted glass"
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
                    placeholder="e.g. Bento, Recharts, Dark Mode, KPI"
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Prompt Recipe (Prompt to generate this UI)
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Used to recreate in Lovable or AI Studio
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formPromptRecipe}
                  onChange={(e) => setFormPromptRecipe(e.target.value)}
                  placeholder="The prompt text you gave AI to build this layout…"
                  className="mt-1 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
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
                  {editingInspoId ? "Update Inspiration" : "Save Inspo to Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Pill tone="leaf">{lightboxItem.category}</Pill>
                  {lightboxItem.author && (
                    <span className="text-xs text-muted-foreground">by {lightboxItem.author}</span>
                  )}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                  {lightboxItem.title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = lightboxItem;
                    setLightboxItem(null);
                    openEditInspoModal(toEdit);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary text-foreground transition"
                >
                  <Pencil className="size-3 text-primary" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* High-res Image Preview */}
            <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-black/50">
              <img
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                className="w-full max-h-[60vh] object-contain"
              />
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              {lightboxItem.description}
            </p>

            {/* Style Notes */}
            {lightboxItem.styleNotes && (
              <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-xs border border-border/40">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Palette className="size-3.5 text-primary" />
                  <span>Design & Styling Notes:</span>
                </p>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  {lightboxItem.styleNotes}
                </p>
              </div>
            )}

            {/* Associated AI Prompt Recipe */}
            <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-primary" />
                  <span>Prompt Recipe:</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(lightboxItem.promptRecipe, lightboxItem.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                >
                  {copiedId === lightboxItem.id ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-2 font-mono text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed overflow-x-auto">
                {lightboxItem.promptRecipe}
              </pre>
            </div>

            {/* Lightbox Footer Actions */}
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(lightboxItem)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Download className="size-3.5" />
                  <span>Download Mockup</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(lightboxItem.id, lightboxItem.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="rounded-lg gradient-leaf px-4 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
