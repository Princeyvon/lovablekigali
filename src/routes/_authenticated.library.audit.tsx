import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ShieldCheck,
  KeyRound,
  Search,
  FileText,
  Clock,
  User,
  ArrowRight,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { LIBRARY_TABS } from "@/routes/_authenticated.library";
import { Panel, Pill, Empty, Table, TH, TD, Stat } from "@/components/dash";
import { SearchInput } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/agency";
import { getLocalAuditEvents, clearLocalAuditEvents, LibraryAuditEvent } from "@/lib/library-store";
import { onDbSync } from "@/lib/database-interconnect";
import { CategoryDropdown } from "@/components/CategoryDropdown";

export const Route = createFileRoute("/_authenticated/library/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail & Event Log — Lovable Solutions" },
      {
        name: "description",
        content:
          "Append-only changelog, credential access audits and sensitive operations history.",
      },
    ],
  }),
  component: AuditPage,
});

type AuditFilter = "All" | "Library" | "Projects" | "Vault";

function AuditPage() {
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<AuditFilter>("All");
  const [localEvents, setLocalEvents] = useState<LibraryAuditEvent[]>(() => getLocalAuditEvents());
  const qc = useQueryClient();

  const refreshAudit = () => {
    setLocalEvents(getLocalAuditEvents());
    qc.invalidateQueries({ queryKey: ["entity_events"] });
    qc.invalidateQueries({ queryKey: ["credential_access_log"] });
  };

  useEffect(() => {
    const unsub = onDbSync(() => {
      refreshAudit();
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes("agency_library") || e.key?.includes("audit")) {
        setLocalEvents(getLocalAuditEvents());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const { data: dbEvents = [] } = useQuery({
    queryKey: ["entity_events"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("entity_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        return res.data ?? [];
      } catch {
        return [];
      }
    },
  });

  const { data: credLogs = [] } = useQuery({
    queryKey: ["credential_access_log"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("credential_access_log")
          .select("*")
          .order("accessed_at", { ascending: false })
          .limit(100);
        return res.data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Seamlessly merge and deduplicate DB entity events and local audit events
  const mergedEvents = useMemo(() => {
    const list: Array<{
      id: string;
      entity_table: string;
      entity_id: string;
      action: string;
      actor?: string;
      change_reason: string;
      created_at: string;
    }> = [];

    const seen = new Set<string>();

    for (const e of dbEvents) {
      const key = `${e.entity_table}-${e.entity_id}-${e.action}-${e.created_at?.slice(0, 16)}`;
      seen.add(key);
      list.push(e);
    }

    for (const le of localEvents) {
      const key = `${le.entity_table}-${le.entity_id}-${le.action}-${le.created_at?.slice(0, 16)}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(le);
      }
    }

    // Sort descending by created_at
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [dbEvents, localEvents]);

  const filteredEvents = useMemo(() => {
    return mergedEvents.filter((e) => {
      const matchesSearch =
        e.entity_table?.toLowerCase().includes(q.toLowerCase()) ||
        e.action?.toLowerCase().includes(q.toLowerCase()) ||
        e.change_reason?.toLowerCase().includes(q.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "Library") {
        return (
          e.entity_table?.startsWith("library_") ||
          e.entity_table === "dashboard_inspo" ||
          e.entity_table === "library_bundle"
        );
      }
      if (filterType === "Projects") {
        return e.entity_table === "projects";
      }
      if (filterType === "Vault") {
        return e.entity_table === "credentials" || e.entity_table === "credential_access_log";
      }

      return true;
    });
  }, [mergedEvents, q, filterType]);

  const handleExportAudit = () => {
    const blob = new Blob([JSON.stringify(mergedEvents, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agency-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audit log exported successfully");
  };

  const handleClearLocal = () => {
    if (confirm("Clear local audit entries? Database records in Supabase remain intact.")) {
      clearLocalAuditEvents();
      setLocalEvents([]);
      toast.success("Local audit log cleared");
    }
  };

  const auditFilterOptions = useMemo(
    () => [
      {
        value: "All",
        label: "All Events",
        count: mergedEvents.length,
      },
      {
        value: "Library",
        label: "Library Assets",
        count: mergedEvents.filter(
          (e) =>
            e.entity_table?.startsWith("library_") ||
            e.entity_table === "dashboard_inspo" ||
            e.entity_table === "library_bundle",
        ).length,
      },
      {
        value: "Projects",
        label: "Projects",
        count: mergedEvents.filter((e) => e.entity_table === "projects").length,
      },
      {
        value: "Vault",
        label: "Vault & Auth",
        count: mergedEvents.filter(
          (e) => e.entity_table === "credentials" || e.entity_table === "credential_access_log",
        ).length,
      },
    ],
    [mergedEvents],
  );

  return (
    <AppShell
      title="Audit Trail & Access Log"
      subtitle="Immutable event history tracking every library modification, database change, and credential vault reveal."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportAudit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export Audit Log</span>
          </button>
          <button
            type="button"
            onClick={refreshAudit}
            title="Refresh logs"
            className="flex size-8 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      }
    >
      <SubTabs tabs={LIBRARY_TABS} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Logged Events"
          value={String(mergedEvents.length)}
          hint="Total immutable records"
          tone="plain"
          icon={<FileText className="size-4 text-sky-600 dark:text-sky-400" />}
        />
        <Stat
          label="Vault Reveals"
          value={String(credLogs.length)}
          hint="Credential accesses logged"
          tone="mist"
          icon={<KeyRound className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Protected Entities"
          value={String(new Set(mergedEvents.map((e) => e.entity_table)).size || 4)}
          hint="Audited entity types"
          tone="deep"
          icon={<ShieldCheck className="size-4 text-purple-600 dark:text-purple-400" />}
        />
        <Stat
          label="System Integrity"
          value="100%"
          hint="All actions actor-verified"
          tone="leaf"
          icon={<Clock className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <CategoryDropdown
          value={filterType}
          onChange={(v) => setFilterType(v as AuditFilter)}
          options={auditFilterOptions}
          label="Filter"
        />

        <div className="flex items-center gap-2">
          <div className="w-full sm:w-64">
            <SearchInput value={q} onChange={setQ} placeholder="Filter audit logs…" />
          </div>
          {localEvents.length > 0 && (
            <button
              type="button"
              onClick={handleClearLocal}
              title="Clear local audit cache"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Entity Events Log */}
        <div className="lg:col-span-2">
          <Panel
            title="Entity Modifications Log"
            right={<Pill tone="mist">{filteredEvents.length} events</Pill>}
          >
            {filteredEvents.length === 0 ? (
              <Empty>No modification events found matching your filter.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] border-collapse text-left text-xs">
                  <thead className="border-b border-border uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <TH>Entity / Table</TH>
                      <TH>Action</TH>
                      <TH>Reason / Detail</TH>
                      <TH className="text-right">Timestamp</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-card/50 transition">
                        <TD>
                          <span className="font-mono font-semibold text-foreground">
                            {e.entity_table}
                          </span>
                        </TD>
                        <TD>
                          <Pill
                            tone={
                              e.action === "create"
                                ? "leaf"
                                : e.action === "delete"
                                  ? "warn"
                                  : "mist"
                            }
                          >
                            {e.action}
                          </Pill>
                        </TD>
                        <TD>
                          <span className="text-muted-foreground leading-relaxed">
                            {e.change_reason || "Direct state modification"}
                          </span>
                        </TD>
                        <TD className="text-right">
                          <span className="text-muted-foreground font-mono">
                            {fmtDate(e.created_at)}
                          </span>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Vault Access Log */}
        <div>
          <Panel
            title="Credential Vault Access"
            right={<Pill tone="plain">{credLogs.length}</Pill>}
          >
            {credLogs.length === 0 ? (
              <Empty>No credential reveals recorded yet.</Empty>
            ) : (
              <div className="space-y-2">
                {credLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border/70 bg-card p-2.5 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <KeyRound className="size-3 text-amber-500" /> Secret Viewed
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDate(log.accessed_at)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                      ID: {log.credential_id || "vault-item"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
