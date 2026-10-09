import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Table as TableIcon,
  LayoutGrid,
  ExternalLink,
  ArrowRight,
  Mail,
  User,
  Building2,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FilterSelect, SearchInput, matches, uniqueOptions } from "@/components/search";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, paidThrough } from "@/lib/agency";
import { fetchMergedClients, PRINCE_MEMBER_ID, PRINCE_MEMBER_NAME } from "@/lib/pipeline-store";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Lovable Solutions" },
      {
        name: "description",
        content: "Signed clients, who onboarded them, and their billing standing.",
      },
      { property: "og:title", content: "Clients — Lovable Solutions" },
      {
        property: "og:description",
        content: "Every signed client with owner, status and paid-through date.",
      },
    ],
  }),
  component: Clients,
});

function Clients() {
  const qc = useQueryClient();
  const { role, memberId } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [rep, setRep] = useState("all");
  const [billing, setBilling] = useState("all");
  const [clientsDisplayMode, setClientsDisplayMode] = useState<"table" | "cards">("table");
  const [form, setForm] = useState({
    business_name: "",
    industry: "",
    contact_name: "",
    contact_email: "",
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchMergedClients,
  });
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
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () =>
      (await supabase.from("payments").select("client_id, covers_period_end, amount")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () =>
      (await supabase.from("subscriptions").select("client_id, monthly_rate, status")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({ ...form, onboarded_by: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      setForm({ business_name: "", industry: "", contact_name: "", contact_email: "" });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () =>
      clients.filter((c) => {
        const through = paidThrough(payments.filter((p) => p.client_id === c.id));
        const isOverdue = !through || through < new Date().toISOString().slice(0, 10);
        return (
          (status === "all" || c.status === status) &&
          (industry === "all" || (c.industry ?? "") === industry) &&
          (rep === "all" || c.onboarded_by === rep) &&
          (billing === "all" || (billing === "overdue" ? isOverdue : !isOverdue)) &&
          matches(q, c.business_name, c.industry, c.contact_name, c.contact_email, c.status)
        );
      }),
    [clients, payments, q, status, industry, rep, billing],
  );

  return (
    <AppShell
      title="Clients"
      subtitle="Signed relationships, owner-credited and audited."
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search clients…" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={["Active", "Paused", "Churned"].map((v) => ({ value: v, label: v }))}
          />
          <FilterSelect
            label="Sector"
            value={industry}
            onChange={setIndustry}
            options={uniqueOptions(clients.map((c) => c.industry))}
          />
          <FilterSelect
            label="Rep"
            value={rep}
            onChange={setRep}
            options={members.map((m) => ({ value: m.id, label: m.full_name }))}
          />
          <FilterSelect
            label="Billing"
            value={billing}
            onChange={setBilling}
            options={[
              { value: "overdue", label: "Overdue" },
              { value: "current", label: "Current" },
            ]}
          />
          {role === "admin" ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {open ? "Close" : "New client"}
            </button>
          ) : null}
        </div>
      }
    >
      {open && (
        <Panel title="Add client">
          <div className="grid gap-3 md:grid-cols-4">
            {(["business_name", "industry", "contact_name", "contact_email"] as const).map((k) => (
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
            Save client
          </button>
        </Panel>
      )}

      <Panel
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-xs">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold text-foreground tracking-tight">
                Client Accounts Directory
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {visible.length} of {clients.length} clients
              </span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
              <button
                type="button"
                onClick={() => setClientsDisplayMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  clientsDisplayMode === "table"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
              >
                <TableIcon className="size-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setClientsDisplayMode("cards")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  clientsDisplayMode === "cards"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Card View"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        }
      >
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No clients yet.</Empty>
        ) : clientsDisplayMode === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table
              head={
                <>
                  <TH>Business</TH>
                  <TH>Industry</TH>
                  <TH>Onboarded by</TH>
                  <TH>Monthly Retainer</TH>
                  <TH>Paid through</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </>
              }
            >
              {visible.map((c) => {
                const through = paidThrough(payments.filter((p) => p.client_id === c.id));
                const rate = subs.find((s) => s.client_id === c.id)?.monthly_rate;
                return (
                  <tr key={c.id} className="transition hover:bg-secondary/40">
                    <TD className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-xs font-bold text-foreground">
                          {c.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <Link
                          to="/clients/$id"
                          params={{ id: c.id }}
                          className="font-semibold text-foreground transition hover:text-primary hover:underline"
                        >
                          {c.business_name}
                        </Link>
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">{c.industry || "—"}</TD>
                    <TD className="text-muted-foreground text-xs">
                      {members.find((m) => m.id === c.onboarded_by)?.full_name ??
                        c.onboarded_by_name ??
                        "—"}
                    </TD>
                    <TD className="font-mono font-semibold text-foreground">
                      {rate ? money(rate) : "—"}
                    </TD>
                    <TD className="font-mono text-xs text-muted-foreground">{fmtDate(through)}</TD>
                    <TD>
                      <Pill
                        tone={
                          c.status === "Active" ? "leaf" : c.status === "Paused" ? "mist" : "warn"
                        }
                      >
                        {c.status}
                      </Pill>
                    </TD>
                    <TD className="text-right">
                      <Link
                        to="/clients/$id"
                        params={{ id: c.id }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-secondary hover:text-foreground"
                      >
                        <span>Open</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </TD>
                  </tr>
                );
              })}
            </Table>
          </div>
        ) : (
          /* CARD VIEW FOR CLIENTS */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => {
              const through = paidThrough(payments.filter((p) => p.client_id === c.id));
              const rate = subs.find((s) => s.client_id === c.id)?.monthly_rate;
              const onboarder =
                members.find((m) => m.id === c.onboarded_by)?.full_name ??
                c.onboarded_by_name ??
                "—";

              return (
                <div
                  key={c.id}
                  className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar, Business Name, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-xs font-bold text-foreground shadow-xs">
                          {c.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/clients/$id"
                            params={{ id: c.id }}
                            className="block truncate font-semibold text-foreground transition hover:text-primary hover:underline"
                            title={c.business_name}
                          >
                            {c.business_name}
                          </Link>
                          {c.industry && (
                            <span className="block truncate text-xs text-muted-foreground mt-0.5">
                              {c.industry}
                            </span>
                          )}
                        </div>
                      </div>

                      <Pill
                        tone={
                          c.status === "Active" ? "leaf" : c.status === "Paused" ? "mist" : "warn"
                        }
                      >
                        {c.status}
                      </Pill>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          Monthly Retainer
                        </span>
                        <span className="mt-0.5 block font-mono font-bold text-foreground">
                          {rate ? money(rate) : "—"}
                          {rate ? (
                            <span className="text-[10px] font-normal text-muted-foreground">
                              /mo
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/50 p-2">
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          Paid Through
                        </span>
                        <span className="mt-0.5 block font-mono text-xs font-semibold text-foreground">
                          {fmtDate(through)}
                        </span>
                      </div>
                    </div>

                    {/* Contact & Onboarded By */}
                    <div className="space-y-1 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="size-3 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">
                          Onboarded by:{" "}
                          <strong className="text-foreground font-medium">{onboarder}</strong>
                        </span>
                      </div>
                      {c.contact_email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="size-3 shrink-0 text-muted-foreground/70" />
                          <span className="truncate font-mono text-[11px]">{c.contact_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Client ID: #{c.id.slice(0, 6)}
                    </span>
                    <Link
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
