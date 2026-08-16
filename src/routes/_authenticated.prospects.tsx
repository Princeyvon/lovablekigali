import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SearchInput, matches } from "@/components/search";
import { Empty, Panel, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SECTORS, fmtDate } from "@/lib/agency";

const STAGES = ["Contacted", "Demo", "Negotiating", "Signed", "Lost"] as const;

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects — Lovable Solutions" },
      { name: "description", content: "Pipeline of businesses approached, by stage and assigned rep." },
      { property: "og:title", content: "Prospects — Lovable Solutions" },
      { property: "og:description", content: "Track the pipeline from first contact to signed." },
    ],
  }),
  component: Prospects,
});

function Prospects() {
  const qc = useQueryClient();
  const { memberId, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    industry: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    source: "",
  });
  const [customSector, setCustomSector] = useState("");
  const [q, setQ] = useState("");

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
      setForm({ business_name: "", industry: "", contact_name: "", contact_email: "", contact_phone: "", source: "" });
      setCustomSector("");
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

  const visible = useMemo(
    () =>
      prospects.filter((p) =>
        matches(q, p.business_name, p.industry, p.contact_name, p.contact_email, p.contact_phone, p.source),
      ),
    [prospects, q],
  );

  return (
    <AppShell
      title="Prospects"
      subtitle="Pipeline by stage — drag-free, one click to advance."
      actions={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search prospects…" />
        <button
          onClick={() => setOpen((v) => !v)}
          className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {open ? "Close" : "New prospect"}
        </button>
        </div>
      }
    >
      {open && (
        <Panel title="Add prospect">
          <div className="grid gap-3 md:grid-cols-3">
            {(["business_name", "contact_name", "contact_email", "contact_phone", "source"] as const).map((k) => (
              <input
                key={k}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={k.replaceAll("_", " ")}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:ring-2 focus:ring-ring"
              />
            ))}
            <select
              value={SECTORS.includes(form.industry as (typeof SECTORS)[number]) || form.industry === "" ? form.industry : "__other"}
              onChange={(e) => {
                if (e.target.value === "__other") {
                  setForm({ ...form, industry: customSector });
                } else {
                  setCustomSector("");
                  setForm({ ...form, industry: e.target.value });
                }
              }}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select sector…</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__other">Other (not listed)</option>
            </select>
            {!SECTORS.includes(form.industry as (typeof SECTORS)[number]) && form.industry !== "" ? null : null}
          </div>
          {(customSector !== "" || (form.industry !== "" && !SECTORS.includes(form.industry as (typeof SECTORS)[number]))) && (
            <input
              value={form.industry}
              onChange={(e) => {
                setCustomSector(e.target.value);
                setForm({ ...form, industry: e.target.value });
              }}
              placeholder="Name the sector"
              className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm md:w-1/3"
            />
          )}
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
          const items = visible.filter((p) => p.stage === stage);
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
                    <p className="text-[11px] text-muted-foreground">{p.contact_email || "no email"}</p>
                    <p className="text-[11px] text-muted-foreground">{p.contact_phone || "no phone"}</p>
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
