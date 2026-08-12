import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/agency";

const STAGES = ["Contacted", "Demo", "Negotiating", "Signed", "Lost"] as const;

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects — Agency OS" },
      { name: "description", content: "Pipeline of businesses approached, by stage and assigned rep." },
      { property: "og:title", content: "Prospects — Agency OS" },
      { property: "og:description", content: "Track the pipeline from first contact to signed." },
    ],
  }),
  component: Prospects,
});

function Prospects() {
  const qc = useQueryClient();
  const { memberId, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ business_name: "", industry: "", contact_name: "", source: "" });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("id, full_name")).data ?? [],
  });

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () =>
      (await supabase.from("prospects").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prospects").insert({ ...form, assigned_rep: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prospect added");
      setForm({ business_name: "", industry: "", contact_name: "", source: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: (typeof STAGES)[number] }) => {
      const { error } = await supabase.from("prospects").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Prospects"
      subtitle="Pipeline by stage — drag-free, one click to advance."
      actions={
        <button
          onClick={() => setOpen((v) => !v)}
          className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {open ? "Close" : "New prospect"}
        </button>
      }
    >
      {open && (
        <Panel title="Add prospect">
          <div className="grid gap-3 md:grid-cols-4">
            {(["business_name", "industry", "contact_name", "source"] as const).map((k) => (
              <input
                key={k}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={k.replace("_", " ")}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:ring-2 focus:ring-ring"
              />
            ))}
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={!form.business_name}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save prospect
          </button>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const items = prospects.filter((p) => p.stage === stage);
          return (
            <div key={stage} className="surface-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{stage}</h3>
                <Pill tone="mist">{items.length}</Pill>
              </div>
              <div className="space-y-2">
                {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                {!isLoading && items.length === 0 && <p className="text-xs text-muted-foreground">Empty</p>}
                {items.map((p) => (
                  <div key={p.id} className="gradient-mist rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{p.business_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.industry || "—"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {members.find((m) => m.id === p.assigned_rep)?.full_name ?? "Unassigned"} · {fmtDate(p.created_at)}
                    </p>
                    <select
                      value={p.stage}
                      onChange={(e) => move.mutate({ id: p.id, stage: e.target.value as (typeof STAGES)[number] })}
                      className="mt-2 w-full rounded-lg border border-border bg-card px-2 py-1 text-xs"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {role === "sales" && <Empty>You see only the prospects assigned to you.</Empty>}
    </AppShell>
  );
}
