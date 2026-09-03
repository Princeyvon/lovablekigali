import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ExternalLink, FileCode2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Empty, Panel, Pill } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadUrl, removeFromLibrary, signedUrl, uploadToLibrary } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/library/skills")({
  head: () => ({
    meta: [
      { title: "Skills — Library — Lovable Solutions" },
      { name: "description", content: "Vibe-coding skills and reusable build kits, with the files attached." },
      { property: "og:title", content: "Skills — Library" },
      { property: "og:description", content: "Upload, keep and download the skill files you reuse." },
    ],
  }),
  component: LibrarySkills,
});

const EMPTY = { title: "", description: "", link: "" };

function LibrarySkills() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["library-skills"],
    queryFn: async () =>
      (await supabase.from("library_skills").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      let file_path: string | null = null;
      if (file) file_path = await uploadToLibrary("skills", file);
      const { error } = await supabase.from("library_skills").insert({
        title: form.title,
        description: form.description || null,
        link: form.link || null,
        file_path,
        file_name: file?.name ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Skill saved");
      setForm(EMPTY);
      setFile(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["library-skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: (typeof skills)[number]) => {
      await removeFromLibrary(row.file_path);
      const { error } = await supabase.from("library_skills").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Skill removed");
      qc.invalidateQueries({ queryKey: ["library-skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (path: string, name: string) => {
    const url = await signedUrl(path);
    if (!url) return toast.error("File is unavailable");
    downloadUrl(url, name);
  };

  const visible = skills.filter((s) => matches(q, s.title, s.description, s.link, s.file_name));

  return (
    <>
      <Panel
        title={`${visible.length} skill${visible.length === 1 ? "" : "s"}`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search skills…" className="sm:w-56" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="gradient-leaf inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> {open ? "Close" : "New skill"}
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
                placeholder="Skill name"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="GitHub or docs link"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
              />
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What it does and when you use it…"
              rows={3}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={!form.title || create.isPending}
              className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Save skill"}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No skills saved yet. Add the first one.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((s) => (
              <article
                key={s.id}
                className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <FileCode2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{s.title}</h3>
                    {s.file_name ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.file_name}</p>
                    ) : null}
                  </div>
                </div>
                {s.description ? (
                  <p className="mt-3 line-clamp-4 text-sm leading-snug text-muted-foreground">{s.description}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {s.file_path ? (
                    <button
                      type="button"
                      onClick={() => void download(s.file_path!, s.file_name ?? "skill.txt")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <Download className="size-3.5" /> Download
                    </button>
                  ) : null}
                  {s.link ? (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <ExternalLink className="size-3.5" /> Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove.mutate(s)}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="How this is used">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Keep vibe-coding skill files, GitHub references and build kits here so every project starts from the same
          proven set. <Pill tone="mist">Files stay private to the team</Pill>
        </p>
      </Panel>
    </>
  );
}
