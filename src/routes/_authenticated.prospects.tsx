import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Kanban,
  Table as TableIcon,
  LayoutList,
  BarChart3,
  Plus,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Pencil,
  Trash2,
  User,
  TrendingUp,
  X,
  Target,
  Users2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PhoneInput } from "@/components/PhoneInput";
import { SearchInput, FilterSelect, matches, uniqueOptions } from "@/components/search";
import { Stat, Pill, Empty, Panel, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SECTORS, fmtDate } from "@/lib/agency";
import {
  ProspectItem,
  ProspectStage,
  PROSPECT_STAGES,
  LEAD_SOURCES,
  fetchMergedProspects,
  upsertLocalProspect,
  updateLocalProspectStage,
  deleteLocalProspect,
  convertProspectToClient,
} from "@/lib/prospects-store";
import { PRINCE_MEMBER_ID, PRINCE_MEMBER_NAME } from "@/lib/pipeline-store";

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects & Pipeline — Lovable Solutions" },
      {
        name: "description",
        content:
          "Track prospective business deals, advance stages, and convert leads to active clients.",
      },
      { property: "og:title", content: "Prospects & Pipeline — Lovable Solutions" },
      {
        property: "og:description",
        content: "Full CRM pipeline with one-click client conversion and deal tracking.",
      },
    ],
  }),
  component: ProspectsPage,
});

const STAGE_CONFIG: Record<
  ProspectStage,
  {
    label: string;
    description: string;
    badgeTone: "leaf" | "mist" | "warn" | "muted";
    dotColor: string;
    headerBg: string;
    nextStage: ProspectStage | null;
  }
> = {
  Contacted: {
    label: "Contacted",
    description: "Initial outreach & inbound inquiries",
    badgeTone: "muted",
    dotColor: "bg-blue-500",
    headerBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    nextStage: "Demo",
  },
  Demo: {
    label: "Demo Scheduled",
    description: "Product walk-throughs & scope review",
    badgeTone: "mist",
    dotColor: "bg-purple-500",
    headerBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    nextStage: "Negotiating",
  },
  Negotiating: {
    label: "Negotiating",
    description: "Contract, SLAs & pricing discussion",
    badgeTone: "mist",
    dotColor: "bg-amber-500",
    headerBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    nextStage: "Signed",
  },
  Signed: {
    label: "Signed / Won",
    description: "Contract executed, ready to build",
    badgeTone: "leaf",
    dotColor: "bg-emerald-500",
    headerBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    nextStage: null,
  },
  Lost: {
    label: "Lost / Closed",
    description: "Postponed or unqualified deals",
    badgeTone: "warn",
    dotColor: "bg-rose-500",
    headerBg: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    nextStage: null,
  },
};

type ViewMode = "board" | "table" | "list" | "funnel";

/** Generates initials for rep profile badge */
function getRepInitials(name?: string): string {
  if (!name) return "U";
  if (name.toLowerCase().includes("prince")) return "PY";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Render a compact profile badge with tooltip instead of full string */
function RepProfileBadge({ name, size = "md" }: { name?: string; size?: "sm" | "md" }) {
  const displayName = name || "Prince Yvon";
  const initials = getRepInitials(displayName);
  const sizeClasses = size === "sm" ? "size-5 text-[10px]" : "size-6 text-[11px]";

  return (
    <div
      title={`Assigned Rep: ${displayName}`}
      className="inline-flex items-center gap-1.5 cursor-default select-none shrink-0"
    >
      <span
        className={`flex ${sizeClasses} items-center justify-center rounded-full bg-primary/15 font-bold text-primary ring-1 ring-primary/25 shadow-xs`}
      >
        {initials}
      </span>
    </div>
  );
}

function ProspectsPage() {
  const qc = useQueryClient();
  const { memberId } = useAuth();

  // View & Filter states
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [rep, setRep] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // New Prospect Form State (no money fields)
  const [form, setForm] = useState({
    business_name: "",
    industry: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    source: "Inbound Website",
    stage: "Contacted" as ProspectStage,
    notes: "",
    assigned_rep: memberId || PRINCE_MEMBER_ID,
  });
  const [customSector, setCustomSector] = useState("");

  // Queries
  const { data: rawMembers = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("id, full_name")).data ?? [],
  });

  const members = useMemo(() => {
    const list = [...rawMembers];
    if (!list.some((m) => m.full_name === PRINCE_MEMBER_NAME || m.id === PRINCE_MEMBER_ID)) {
      list.push({ id: PRINCE_MEMBER_ID, full_name: PRINCE_MEMBER_NAME });
    }
    return list;
  }, [rawMembers]);

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospects"],
    queryFn: fetchMergedProspects,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.business_name.trim()) throw new Error("Business name is required");
      const assignedRepObj = members.find((m) => m.id === form.assigned_rep);

      const newProspect: ProspectItem = {
        id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        business_name: form.business_name.trim(),
        industry: form.industry || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        source: form.source || null,
        stage: form.stage,
        assigned_rep: form.assigned_rep || PRINCE_MEMBER_ID,
        assigned_rep_name: assignedRepObj?.full_name ?? PRINCE_MEMBER_NAME,
        client_id: null,
        notes: form.notes || null,
        created_at: new Date().toISOString(),
      };

      upsertLocalProspect(newProspect);

      try {
        await supabase.from("prospects").insert({
          id: newProspect.id,
          business_name: newProspect.business_name,
          industry: newProspect.industry,
          contact_name: newProspect.contact_name,
          contact_email: newProspect.contact_email,
          contact_phone: newProspect.contact_phone,
          source: newProspect.source,
          stage: newProspect.stage,
          assigned_rep: newProspect.assigned_rep,
        });
      } catch (e) {
        console.warn("Supabase prospect insert warning (saved locally):", e);
      }
    },
    onSuccess: () => {
      toast.success("Prospect created successfully");
      setIsAddOpen(false);
      setForm({
        business_name: "",
        industry: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        source: "Inbound Website",
        stage: "Contacted",
        notes: "",
        assigned_rep: memberId || PRINCE_MEMBER_ID,
      });
      setCustomSector("");
      qc.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ProspectStage }) => {
      updateLocalProspectStage(id, stage);
      try {
        await supabase.from("prospects").update({ stage }).eq("id", id);
      } catch (e) {
        console.warn("Supabase stage update warning:", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Deal stage updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async (updated: ProspectItem) => {
      upsertLocalProspect(updated);
      try {
        await supabase
          .from("prospects")
          .update({
            business_name: updated.business_name,
            industry: updated.industry,
            contact_name: updated.contact_name,
            contact_email: updated.contact_email,
            contact_phone: updated.contact_phone,
            source: updated.source,
            stage: updated.stage,
            assigned_rep: updated.assigned_rep,
          })
          .eq("id", updated.id);
      } catch (e) {
        console.warn("Supabase details update warning:", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      setIsEditOpen(false);
      setSelectedProspect(null);
      toast.success("Prospect details updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      deleteLocalProspect(id);
      try {
        await supabase.from("prospects").delete().eq("id", id);
      } catch (e) {
        console.warn("Supabase delete warning:", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      setIsEditOpen(false);
      setSelectedProspect(null);
      toast.success("Prospect removed from pipeline");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async (prospect: ProspectItem) => {
      const result = await convertProspectToClient(prospect);
      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`${result.client.business_name} converted to active Client!`, {
        description: "Created in Clients directory and ready in Build Pipeline.",
      });
      setIsEditOpen(false);
      setSelectedProspect(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filtered list
  const visible = useMemo(() => {
    return prospects.filter((p) => {
      const repMatch = rep === "all" || p.assigned_rep === rep;
      const sectorMatch = sector === "all" || (p.industry ?? "") === sector;
      const stageMatch = stageFilter === "all" || p.stage === stageFilter;
      const sourceMatch = sourceFilter === "all" || (p.source ?? "") === sourceFilter;
      const searchMatch = matches(
        q,
        p.business_name,
        p.industry,
        p.contact_name,
        p.contact_email,
        p.contact_phone,
        p.source,
        p.notes,
        p.assigned_rep_name,
      );
      return repMatch && sectorMatch && stageMatch && sourceMatch && searchMatch;
    });
  }, [prospects, q, sector, rep, stageFilter, sourceFilter]);

  // Analytics without money
  const stats = useMemo(() => {
    const total = prospects.length;
    const active = prospects.filter((p) => ["Contacted", "Demo", "Negotiating"].includes(p.stage));
    const demoAndNeg = prospects.filter((p) => ["Demo", "Negotiating"].includes(p.stage));
    const signed = prospects.filter((p) => p.stage === "Signed");
    const lost = prospects.filter((p) => p.stage === "Lost");
    const winRate = total > 0 ? Math.round((signed.length / total) * 100) : 0;

    return {
      total,
      activeCount: active.length,
      demoAndNegCount: demoAndNeg.length,
      signedCount: signed.length,
      lostCount: lost.length,
      winRate,
    };
  }, [prospects]);

  // Quick 1-click stage advancement
  const handleAdvance = (p: ProspectItem) => {
    const currentConfig = STAGE_CONFIG[p.stage];
    if (currentConfig.nextStage) {
      updateStageMutation.mutate({ id: p.id, stage: currentConfig.nextStage });
    }
  };

  const openEdit = (p: ProspectItem) => {
    setSelectedProspect(p);
    setIsEditOpen(true);
  };

  return (
    <AppShell
      title="Prospects & Pipeline"
      subtitle="Track leads through outreach, demo, negotiation, and one-click client conversion."
      actions={
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:justify-end">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-xs">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "board"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Kanban className="size-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="size-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="size-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("funnel")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "funnel"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="size-3.5" />
              <span>Funnel</span>
            </button>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="gradient-leaf flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-98"
          >
            <Plus className="size-4" />
            <span>New prospect</span>
          </button>
        </div>
      }
    >
      {/* Metrics Row (No Money Indicators) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Prospects"
          value={String(stats.total)}
          hint="Leads tracked in CRM"
          tone="plain"
          icon={<Users2 className="size-4 text-sky-600 dark:text-sky-400" />}
        />
        <Stat
          label="Active Leads"
          value={String(stats.activeCount)}
          hint="Currently in pipeline"
          tone="mist"
          icon={<TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Demo & Negotiation"
          value={String(stats.demoAndNegCount)}
          hint="High-intent opportunities"
          tone="deep"
          icon={<Target className="size-4 text-purple-600 dark:text-purple-400" />}
        />
        <Stat
          label="Signed / Won"
          value={String(stats.signedCount)}
          hint={`${stats.winRate}% conversion rate`}
          tone="leaf"
          icon={<CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="w-full sm:w-72">
          <SearchInput value={q} onChange={setQ} placeholder="Search leads, contacts, phone…" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Stage"
            value={stageFilter}
            onChange={setStageFilter}
            options={PROSPECT_STAGES.map((s) => ({ value: s, label: STAGE_CONFIG[s].label }))}
          />

          <FilterSelect
            label="Sector"
            value={sector}
            onChange={setSector}
            options={uniqueOptions(prospects.map((p) => p.industry))}
          />

          <FilterSelect
            label="Rep"
            value={rep}
            onChange={setRep}
            options={members.map((m) => ({ value: m.id, label: m.full_name }))}
          />

          <FilterSelect
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
          />

          {(q ||
            sector !== "all" ||
            stageFilter !== "all" ||
            rep !== "all" ||
            sourceFilter !== "all") && (
            <button
              onClick={() => {
                setQ("");
                setSector("all");
                setStageFilter("all");
                setRep("all");
                setSourceFilter("all");
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* MAIN VIEW 1: REFINED BOARD (ZERO OVERFLOW, PROFILE BADGE, PENCIL EDIT) */}
      {viewMode === "board" && (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 [scrollbar-width:thin]">
          {PROSPECT_STAGES.filter((s) => stageFilter === "all" || s === stageFilter).map(
            (colStage) => {
              const items = visible.filter((p) => p.stage === colStage);
              const cfg = STAGE_CONFIG[colStage];

              return (
                <div
                  key={colStage}
                  className="flex w-[20.5rem] min-w-[19rem] shrink-0 flex-col rounded-2xl border border-border/80 bg-card/60 shadow-xs"
                >
                  {/* Column Header */}
                  <div className="border-b border-border/60 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2.5 shrink-0 rounded-full ${cfg.dotColor}`} />
                        <h3 className="truncate font-display text-sm font-semibold tracking-tight">
                          {cfg.label}
                        </h3>
                      </div>
                      <Pill tone={cfg.badgeTone}>{items.length}</Pill>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {cfg.description}
                    </p>
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 space-y-3 p-3">
                    {isLoading && (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Loading leads…
                      </div>
                    )}

                    {!isLoading && items.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 py-10 text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          No leads in {colStage}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Add or advance deals here
                        </p>
                      </div>
                    )}

                    {items.map((p) => {
                      const repName =
                        members.find((m) => m.id === p.assigned_rep)?.full_name ??
                        p.assigned_rep_name ??
                        "Prince Yvon";

                      return (
                        <div
                          key={p.id}
                          className="group relative rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                        >
                          {/* Header: Business & Pencil Edit Icon */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4
                                onClick={() => openEdit(p)}
                                className="cursor-pointer truncate font-display text-sm font-semibold tracking-tight text-foreground transition hover:text-primary hover:underline"
                                title={p.business_name}
                              >
                                {p.business_name}
                              </h4>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="truncate">{p.industry || "General"}</span>
                                {p.source && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate text-[11px] text-muted-foreground/80">
                                      {p.source}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Pencil Edit Icon Button */}
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              title="Edit prospect info"
                              className="rounded-lg border border-border/70 bg-card p-1.5 text-muted-foreground transition hover:border-primary hover:bg-secondary hover:text-primary shrink-0"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </div>

                          {/* Contact details box (Overflow prevented) */}
                          {(p.contact_name || p.contact_email || p.contact_phone) && (
                            <div className="mt-2.5 rounded-lg border border-border/50 bg-secondary/30 p-2 text-xs">
                              {p.contact_name && (
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                  <User className="size-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{p.contact_name}</span>
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                                {p.contact_email && (
                                  <a
                                    href={`mailto:${p.contact_email}`}
                                    className="inline-flex min-w-0 max-w-[150px] items-center gap-1 hover:text-foreground hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                    title={p.contact_email}
                                  >
                                    <Mail className="size-3 shrink-0" />
                                    <span className="truncate">{p.contact_email}</span>
                                  </a>
                                )}
                                {p.contact_phone && (
                                  <a
                                    href={`tel:${p.contact_phone}`}
                                    className="inline-flex min-w-0 max-w-[130px] items-center gap-1 hover:text-foreground hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                    title={p.contact_phone}
                                  >
                                    <Phone className="size-3 shrink-0" />
                                    <span className="truncate">{p.contact_phone}</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Notes preview */}
                          {p.notes && (
                            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground italic break-words">
                              "{p.notes}"
                            </p>
                          )}

                          {/* Card Footer: Rep Profile Badge & Stage Actions (Zero Overflow) */}
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
                            {/* Profile Badge ONLY (no full name string) */}
                            <RepProfileBadge name={repName} />

                            <div className="flex items-center gap-1.5 min-w-0">
                              {/* Convert to Client Button */}
                              {p.client_id ? (
                                <Link
                                  to="/clients"
                                  className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 shrink-0"
                                >
                                  <CheckCircle2 className="size-3" />
                                  <span>Active</span>
                                </Link>
                              ) : p.stage === "Signed" ? (
                                <button
                                  onClick={() => convertMutation.mutate(p)}
                                  disabled={convertMutation.isPending}
                                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-emerald-700 shrink-0"
                                >
                                  <Sparkles className="size-3" />
                                  <span>Convert</span>
                                </button>
                              ) : null}

                              {/* One click advance button */}
                              {cfg.nextStage && (
                                <button
                                  onClick={() => handleAdvance(p)}
                                  title={`Advance to ${cfg.nextStage}`}
                                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary shrink-0"
                                >
                                  <span className="max-w-[70px] truncate">{cfg.nextStage}</span>
                                  <ArrowRight className="size-3 shrink-0" />
                                </button>
                              )}

                              {/* Stage changer select dropdown */}
                              <select
                                value={p.stage}
                                onChange={(e) =>
                                  updateStageMutation.mutate({
                                    id: p.id,
                                    stage: e.target.value as ProspectStage,
                                  })
                                }
                                className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] text-muted-foreground outline-none"
                              >
                                {PROSPECT_STAGES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* MAIN VIEW 2: NEW ALTERNATIVE VIEW (LIST / FEED VIEW) */}
      {viewMode === "list" && (
        <Panel
          title={`Prospect Pipeline List (${visible.length})`}
          right={
            <div className="flex items-center gap-2">
              <Pill tone="leaf">{visible.filter((p) => p.stage === "Signed").length} Won</Pill>
              <Pill tone="mist">
                {visible.filter((p) => p.stage !== "Signed" && p.stage !== "Lost").length} Active
              </Pill>
            </div>
          }
        >
          {visible.length === 0 ? (
            <Empty>No prospects match the filter criteria.</Empty>
          ) : (
            <div className="space-y-3">
              {visible.map((p) => {
                const repName =
                  members.find((m) => m.id === p.assigned_rep)?.full_name ??
                  p.assigned_rep_name ??
                  "Prince Yvon";
                const cfg = STAGE_CONFIG[p.stage];

                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition hover:border-border hover:shadow-md lg:flex-row lg:items-center lg:justify-between"
                  >
                    {/* Left: Lead details */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
                        <Building2 className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            onClick={() => openEdit(p)}
                            className="cursor-pointer font-display text-base font-semibold text-foreground hover:text-primary hover:underline truncate"
                          >
                            {p.business_name}
                          </h4>
                          <Pill tone={cfg.badgeTone}>{p.stage}</Pill>
                          {p.industry && (
                            <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                              {p.industry}
                            </span>
                          )}
                          {p.source && (
                            <span className="text-[11px] text-muted-foreground">
                              via {p.source}
                            </span>
                          )}
                        </div>

                        {/* Contacts & Notes */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {p.contact_name && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <User className="size-3 text-muted-foreground" />
                              {p.contact_name}
                            </span>
                          )}
                          {p.contact_email && (
                            <a
                              href={`mailto:${p.contact_email}`}
                              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                            >
                              <Mail className="size-3" />
                              {p.contact_email}
                            </a>
                          )}
                          {p.contact_phone && (
                            <a
                              href={`tel:${p.contact_phone}`}
                              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                            >
                              <Phone className="size-3" />
                              {p.contact_phone}
                            </a>
                          )}
                          <span className="text-[11px] text-muted-foreground/70">
                            Added {fmtDate(p.created_at)}
                          </span>
                        </div>

                        {p.notes && (
                          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground/90 italic">
                            "{p.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions, Stage changer, Profile badge & Pencil edit */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-2.5 lg:border-t-0 lg:pt-0 lg:justify-end shrink-0">
                      {/* Rep Profile badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">Rep:</span>
                        <RepProfileBadge name={repName} size="md" />
                      </div>

                      {/* Convert to Client */}
                      {p.stage === "Signed" && !p.client_id && (
                        <button
                          onClick={() => convertMutation.mutate(p)}
                          disabled={convertMutation.isPending}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                        >
                          <Sparkles className="size-3.5" />
                          <span>Convert to Client</span>
                        </button>
                      )}

                      {/* Next Stage button */}
                      {cfg.nextStage && (
                        <button
                          onClick={() => handleAdvance(p)}
                          className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition"
                        >
                          <span>Move to {cfg.nextStage}</span>
                          <ArrowRight className="size-3.5" />
                        </button>
                      )}

                      {/* Stage selector dropdown */}
                      <select
                        value={p.stage}
                        onChange={(e) =>
                          updateStageMutation.mutate({
                            id: p.id,
                            stage: e.target.value as ProspectStage,
                          })
                        }
                        className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground font-medium outline-none focus:ring-1 focus:ring-primary"
                      >
                        {PROSPECT_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      {/* Pencil Edit Icon Button */}
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        title="Edit prospect"
                        className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:bg-secondary hover:text-primary transition"
                      >
                        <Pencil className="size-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* MAIN VIEW 3: TABLE VIEW (NO MONEY, PROFILE BADGE, PENCIL ICON) */}
      {viewMode === "table" && (
        <Panel
          title={`All Prospects (${visible.length})`}
          right={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{visible.filter((p) => p.stage === "Signed").length} Signed</span>
              <span>·</span>
              <span>
                {visible.filter((p) => p.stage !== "Signed" && p.stage !== "Lost").length} In
                Progress
              </span>
            </div>
          }
        >
          {visible.length === 0 ? (
            <Empty>No prospects match the filter criteria.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead className="border-b border-border">
                  <tr>
                    <TH>Business & Sector</TH>
                    <TH>Primary Contact</TH>
                    <TH>Deal Stage</TH>
                    <TH>Source</TH>
                    <TH>Assigned Rep</TH>
                    <TH>Added Date</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visible.map((p) => {
                    const repName =
                      members.find((m) => m.id === p.assigned_rep)?.full_name ??
                      p.assigned_rep_name ??
                      "Prince Yvon";

                    return (
                      <tr key={p.id} className="hover:bg-card/50 transition">
                        <TD>
                          <div className="flex flex-col">
                            <span
                              onClick={() => openEdit(p)}
                              className="cursor-pointer font-semibold text-foreground hover:text-primary hover:underline"
                            >
                              {p.business_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {p.industry || "General Sector"}
                            </span>
                          </div>
                        </TD>

                        <TD>
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-foreground">
                              {p.contact_name || "—"}
                            </span>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {p.contact_email && (
                                <a href={`mailto:${p.contact_email}`} className="hover:underline">
                                  {p.contact_email}
                                </a>
                              )}
                              {p.contact_phone && <span>· {p.contact_phone}</span>}
                            </div>
                          </div>
                        </TD>

                        <TD>
                          <div className="flex items-center gap-1.5">
                            <Pill tone={STAGE_CONFIG[p.stage].badgeTone}>{p.stage}</Pill>
                            <select
                              value={p.stage}
                              onChange={(e) =>
                                updateStageMutation.mutate({
                                  id: p.id,
                                  stage: e.target.value as ProspectStage,
                                })
                              }
                              className="rounded border border-border bg-card px-1 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {PROSPECT_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TD>

                        <TD>
                          <span className="text-xs text-muted-foreground">{p.source || "—"}</span>
                        </TD>

                        <TD>
                          {/* Profile badge ONLY (no full name text) */}
                          <RepProfileBadge name={repName} />
                        </TD>

                        <TD>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(p.created_at)}
                          </span>
                        </TD>

                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.stage === "Signed" && !p.client_id && (
                              <button
                                onClick={() => convertMutation.mutate(p)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-xs hover:bg-emerald-700"
                              >
                                <Sparkles className="size-3" />
                                <span>Convert</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition"
                              title="Edit details"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </div>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* MAIN VIEW 4: FUNNEL & ANALYTICS VIEW (NO MONEY INDICATORS) */}
      {viewMode === "funnel" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Funnel Stage Breakdown */}
          <Panel title="Pipeline Conversion Funnel">
            <div className="space-y-4 pt-1">
              {PROSPECT_STAGES.map((stg) => {
                const count = prospects.filter((p) => p.stage === stg).length;
                const total = prospects.length || 1;
                const pct = Math.round((count / total) * 100);
                const cfg = STAGE_CONFIG[stg];

                return (
                  <div key={stg} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <span className={`size-2 rounded-full ${cfg.dotColor}`} />
                        <span>{cfg.label}</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {count} leads ({pct}%)
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/80">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cfg.dotColor}`}
                        style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-border/80 bg-secondary/30 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Pipeline Win Rate</span>
                <span className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.winRate}%
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {stats.signedCount} out of {stats.total} total leads successfully signed and
                converted.
              </p>
            </div>
          </Panel>

          {/* Lead Sources Distribution */}
          <Panel title="Lead Sources & Rep Performance">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top Lead Channels
              </h4>
              {LEAD_SOURCES.map((src) => {
                const count = prospects.filter((p) => p.source === src).length;
                if (count === 0) return null;
                const pct = Math.round((count / (prospects.length || 1)) * 100);

                return (
                  <div
                    key={src}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-xs"
                  >
                    <span className="font-medium text-foreground">{src}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{pct}%</span>
                      <Pill tone="mist">{count} leads</Pill>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 space-y-3 border-t border-border/60 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Team Members
              </h4>
              {members.map((m) => {
                const repLeads = prospects.filter((p) => p.assigned_rep === m.id);
                const signedLeads = repLeads.filter((p) => p.stage === "Signed").length;
                if (repLeads.length === 0 && m.id !== PRINCE_MEMBER_ID) return null;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <RepProfileBadge name={m.full_name} size="md" />
                      <div>
                        <p className="font-semibold text-foreground">{m.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {repLeads.length} total assigned
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {signedLeads} Won
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {repLeads.length > 0
                          ? Math.round((signedLeads / repLeads.length) * 100)
                          : 0}
                        % win rate
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* NEW PROSPECT MODAL (NO MONEY FIELDS) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border p-5 shadow-2xl animate-in fade-in zoom-in-95 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-lg font-bold">Add New Prospect</h3>
                <p className="text-xs text-muted-foreground">
                  Record a potential client deal to start tracking through the pipeline.
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Business Name *
                  </label>
                  <input
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    placeholder="e.g. Kigali Logistics Group"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Industry / Sector
                  </label>
                  <select
                    value={
                      SECTORS.includes(form.industry as (typeof SECTORS)[number]) ||
                      form.industry === ""
                        ? form.industry
                        : "__other"
                    }
                    onChange={(e) => {
                      if (e.target.value === "__other") {
                        setForm({ ...form, industry: customSector });
                      } else {
                        setCustomSector("");
                        setForm({ ...form, industry: e.target.value });
                      }
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select industry…</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="__other">Other (Custom)</option>
                  </select>
                </div>

                {(!SECTORS.includes(form.industry as (typeof SECTORS)[number]) &&
                  form.industry !== "") ||
                customSector !== "" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Custom Sector Name
                    </label>
                    <input
                      value={form.industry}
                      onChange={(e) => {
                        setCustomSector(e.target.value);
                        setForm({ ...form, industry: e.target.value });
                      }}
                      placeholder="Specify sector"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Lead Source
                    </label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Primary Contact Name
                  </label>
                  <input
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="e.g. Diane Ingabire"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="contact@company.rw"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Phone
                  </label>
                  <PhoneInput
                    value={form.contact_phone}
                    onChange={(v) => setForm({ ...form, contact_phone: v })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Initial Stage
                  </label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value as ProspectStage })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PROSPECT_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Assigned Sales Rep
                  </label>
                  <select
                    value={form.assigned_rep}
                    onChange={(e) => setForm({ ...form, assigned_rep: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Deal Notes & Requirements
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Key deliverables, timeline, requirements or scheduled follow-ups…"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.business_name.trim() || createMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Save Prospect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / DETAIL PROSPECT MODAL (WITH PENCIL ICON ACCESS, NO MONEY FIELDS) */}
      {isEditOpen && selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border p-5 shadow-2xl animate-in fade-in zoom-in-95 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold">
                    {selectedProspect.business_name}
                  </h3>
                  <Pill tone={STAGE_CONFIG[selectedProspect.stage].badgeTone}>
                    {selectedProspect.stage}
                  </Pill>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added on {fmtDate(selectedProspect.created_at)}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedProspect(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Conversion Banner if ready */}
              {!selectedProspect.client_id && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Convert to Active Client
                    </p>
                    <p className="text-emerald-700/80 dark:text-emerald-400">
                      Promotes this lead to a signed relationship and opens a project in Build
                      Pipeline.
                    </p>
                  </div>
                  <button
                    onClick={() => convertMutation.mutate(selectedProspect)}
                    disabled={convertMutation.isPending}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Convert Now</span>
                  </button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Business Name
                  </label>
                  <input
                    value={selectedProspect.business_name}
                    onChange={(e) =>
                      setSelectedProspect({ ...selectedProspect, business_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sector</label>
                  <select
                    value={selectedProspect.industry ?? ""}
                    onChange={(e) =>
                      setSelectedProspect({ ...selectedProspect, industry: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select industry…</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Pipeline Stage
                  </label>
                  <select
                    value={selectedProspect.stage}
                    onChange={(e) =>
                      setSelectedProspect({
                        ...selectedProspect,
                        stage: e.target.value as ProspectStage,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PROSPECT_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Person
                  </label>
                  <input
                    value={selectedProspect.contact_name ?? ""}
                    onChange={(e) =>
                      setSelectedProspect({ ...selectedProspect, contact_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Email
                  </label>
                  <input
                    value={selectedProspect.contact_email ?? ""}
                    onChange={(e) =>
                      setSelectedProspect({ ...selectedProspect, contact_email: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Phone
                  </label>
                  <PhoneInput
                    value={selectedProspect.contact_phone ?? ""}
                    onChange={(v) => setSelectedProspect({ ...selectedProspect, contact_phone: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Lead Source</label>
                  <select
                    value={selectedProspect.source ?? ""}
                    onChange={(e) =>
                      setSelectedProspect({ ...selectedProspect, source: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Assigned Rep
                  </label>
                  <select
                    value={selectedProspect.assigned_rep ?? ""}
                    onChange={(e) => {
                      const repObj = members.find((m) => m.id === e.target.value);
                      setSelectedProspect({
                        ...selectedProspect,
                        assigned_rep: e.target.value,
                        assigned_rep_name: repObj?.full_name,
                      });
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Notes</label>
                <textarea
                  rows={3}
                  value={selectedProspect.notes ?? ""}
                  onChange={(e) =>
                    setSelectedProspect({ ...selectedProspect, notes: e.target.value })
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <button
                onClick={() => {
                  if (confirm(`Delete ${selectedProspect.business_name} permanently?`)) {
                    deleteMutation.mutate(selectedProspect.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
              >
                <Trash2 className="size-4" />
                <span>Delete Lead</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsEditOpen(false);
                    setSelectedProspect(null);
                  }}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateDetailsMutation.mutate(selectedProspect)}
                  disabled={updateDetailsMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {updateDetailsMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
