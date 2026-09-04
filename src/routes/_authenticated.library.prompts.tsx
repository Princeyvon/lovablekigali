import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Empty, Panel, Pill } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { copyText } from "@/lib/library";
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
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["library-prompts"],
    queryFn: async () =>
      (await supabase.from("library_prompts").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("library_prompts").insert({
        title: form.title,
        category: form.category || null,
        body: form.body,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prompt saved");
      setForm(EMPTY);
      setOpen(false);
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

  return (
    <>
      <Panel
        title={`${visible.length} prompt${visible.length === 1 ? "" : "s"}`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search prompts…" className="sm:w-56" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
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
              onClick={() => create.mutate()}
              disabled={!form.title || !form.body || create.isPending}
              className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Save prompt"}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No prompts saved yet.</Empty>
        ) : (
          <div className="space-y-2">
            {visible.map((p) => {
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 p-3">
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
                      onClick={() => remove.mutate(p.id)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
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
