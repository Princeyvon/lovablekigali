import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Empty, Panel } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { copyImage, downloadUrl, removeFromLibrary, signedUrl, uploadToLibrary } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/library/themes")({
  head: () => ({
    meta: [
      { title: "UI Themes — Library — Lovable Solutions" },
      { name: "description", content: "Dashboard UI theme references you can view large, copy or download." },
      { property: "og:title", content: "UI Themes — Library" },
      { property: "og:description", content: "Screenshots of dashboard themes worth reusing." },
    ],
  }),
  component: LibraryThemes,
});

const EMPTY = { title: "", notes: "", source_url: "" };

function LibraryThemes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState<{ url: string; title: string } | null>(null);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ["library-themes"],
    queryFn: async () =>
      (await supabase.from("library_themes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: urls = {} } = useQuery({
    queryKey: ["library-theme-urls", themes.map((t) => t.id).join(",")],
    enabled: themes.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        themes.map(async (t) => [t.id, await signedUrl(t.image_path)] as const),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick an image first");
      const image_path = await uploadToLibrary("themes", file);
      const { error } = await supabase.from("library_themes").insert({
        title: form.title,
        notes: form.notes || null,
        source_url: form.source_url || null,
        image_path,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Theme saved");
      setForm(EMPTY);
      setFile(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["library-themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: (typeof themes)[number]) => {
      await removeFromLibrary(row.image_path);
      const { error } = await supabase.from("library_themes").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Theme removed");
      qc.invalidateQueries({ queryKey: ["library-themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const visible = themes.filter((t) => matches(q, t.title, t.notes, t.source_url));

  return (
    <>
      <Panel
        title={`${visible.length} theme${visible.length === 1 ? "" : "s"}`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search themes…" className="sm:w-56" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="gradient-leaf inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> {open ? "Close" : "New theme"}
            </button>
          </div>
        }
      >
        {open ? (
          <div className="mb-5 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Theme name"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                placeholder="Source link (optional)"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
              />
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What you like about it…"
              rows={2}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={!form.title || !file || create.isPending}
              className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Uploading…" : "Save theme"}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No themes yet. Upload the first screenshot.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((t) => {
              const url = urls[t.id] ?? null;
              return (
                <figure
                  key={t.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]"
                >
                  <button
                    type="button"
                    onClick={() => url && setZoom({ url, title: t.title })}
                    className="block w-full"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={t.title}
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="aspect-[16/10] w-full animate-pulse bg-secondary" />
                    )}
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!url) return;
                        const kind = await copyImage(url);
                        toast.success(kind === "image" ? "Image copied" : "Link copied");
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-white/90 px-2 text-[11px] font-semibold text-black"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => url && downloadUrl(url, `${t.title}.png`)}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-white/90 px-2 text-[11px] font-semibold text-black"
                    >
                      <Download className="size-3" /> Download
                    </button>
                    {t.source_url ? (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-white/90 px-2 text-[11px] font-semibold text-black"
                      >
                        <ExternalLink className="size-3" /> Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove.mutate(t)}
                      className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-destructive px-2 text-[11px] font-semibold text-destructive-foreground"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  </div>
                  <figcaption className="border-t border-border px-3 py-2">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    {t.notes ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.notes}</p>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </Panel>

      {zoom ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full w-full max-w-5xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="text-sm font-semibold">{zoom.title}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadUrl(zoom.url, `${zoom.title}.png`)}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-white/90 px-2.5 text-xs font-semibold text-black"
                >
                  <Download className="size-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(null)}
                  className="inline-flex size-8 items-center justify-center rounded-md bg-white/15"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <img src={zoom.url} alt={zoom.title} className="w-full rounded-xl" />
          </div>
        </div>
      ) : null}
    </>
  );
}
