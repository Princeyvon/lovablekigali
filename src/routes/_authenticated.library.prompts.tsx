import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronDown, Copy, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Empty, Panel, Pill } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDragOrder } from "@/hooks/useDragOrder";
import { copyText, saveOrder } from "@/lib/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library/prompts")({
  head: () => ({
    meta: [
      { title: "Prompts — Library — Lovable Solutions" },
      { name: "description", content: "Reusable prompts for repeated builds, copied to the clipboard in one tap." },
      { property: "og:title", content: "Prompts — Library" },
      { property: "og:description", content: "The prompts you reach for on every build." },
    ],
  }),
  component: LibraryPrompts,
});

const EMPTY = { title: "", category: "", body: "" };

function LibraryPrompts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["library-prompts"],
    queryFn: async () =>
      (
        await supabase
          .from("library_prompts")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const closeForm = () => {
    setForm(EMPTY);
    setEditing(null);
    setOpen(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, category: form.category || null, body: form.body };
      const { error } = editing
        ? await supabase.from("library_prompts").update(payload).eq("id", editing)
        : await supabase.from("library_prompts").insert({ ...payload, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Prompt updated" : "Prompt saved");
      closeForm();
      qc.invalidateQueries({ queryKey: ["library-prompts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("library_prompts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prompt removed");
      qc.invalidateQueries({ queryKey: ["library-prompts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (id: string, body: string) => {
    await copyText(body);
    setCopied(id);
    toast.success("Prompt copied");
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const visible = prompts.filter((p) => matches(q, p.title, p.category, p.body));
  const { list, dragId, dragProps } = useDragOrder(visible, (ids) => {
    void saveOrder("library_prompts", ids).then(() => qc.invalidateQueries({ queryKey: ["library-prompts"] }));
  });

  const startEdit = (p: (typeof prompts)[number]) => {
    setForm({ title: p.title, category: p.category ?? "", body: p.body });
    setEditing(p.id);
    setOpen(true);
  };

  return (
    <>
      <Panel
        title={`${visible.length} prompt${visible.length === 1 ? "" : "s"}`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search prompts…" className="sm:w-56" />
            <button
              type="button"
              onClick={() => (open ? closeForm() : setOpen(true))}
              className="gradient-leaf inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> {open ? "Close" : "New prompt"}
            </button>
          </div>
        }
      >
        {open ? (
          <div className="mb-5 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Prompt title"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Category (UI, assistant, ops…)"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Paste the prompt…"
              rows={6}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={!form.title || !form.body || save.isPending}
              className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : editing ? "Update prompt" : "Save prompt"}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : list.length === 0 ? (
          <Empty>No prompts saved yet.</Empty>
        ) : (
          <div className="space-y-2">
            {list.map((p) => {
              const isOpen = expanded === p.id;
              return (
                <div
                  key={p.id}
                  {...dragProps(p.id)}
                  className={cn(
                    "group overflow-hidden rounded-xl border border-border bg-card transition",
                    dragId === p.id && "opacity-50 ring-2 ring-primary/40",
                  )}
                >
                  <div className="flex items-center gap-1.5 p-3">
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                      />
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      {p.category ? <Pill tone="mist">{p.category}</Pill> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(p.id, p.body)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-secondary"
                    >
                      {copied === p.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                      aria-label="Edit prompt"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(p.id)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-destructive opacity-0 transition hover:bg-destructive/10 group-hover:opacity-100"
                      aria-label="Remove prompt"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {isOpen ? (
                    <pre className="max-h-96 overflow-auto border-t border-border bg-secondary/40 p-4 text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {p.body}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
