import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Award, CheckCircle2, Clock, Mail, Shield, X, DollarSign } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { FINANCE_TABS } from "@/routes/_authenticated.finance";
import { Stat, Panel, Pill, Table, TH, TD, Empty } from "@/components/dash";
import { SearchInput, FilterSelect, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money } from "@/lib/agency";
import { PRINCE_MEMBER_ID, PRINCE_MEMBER_NAME } from "@/lib/pipeline-store";

export const Route = createFileRoute("/_authenticated/finance/team")({
  head: () => ({
    meta: [
      { title: "Team & Commissions — Lovable Solutions" },
      {
        name: "description",
        content: "Team members, roles, sales commission payouts and tracking.",
      },
    ],
  }),
  component: TeamFinancePage,
});

function TeamFinancePage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddCommissionOpen, setIsAddCommissionOpen] = useState(false);

  const [memberForm, setMemberForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "Sales" as "Sales" | "Dev" | "Support" | "Admin",
  });

  const [commForm, setCommForm] = useState({
    rep_id: PRINCE_MEMBER_ID,
    client_id: "",
    amount: "250",
    type: "Signing Bonus",
    status: "Pending",
  });

  const { data: rawMembers = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () =>
      (await supabase.from("team_members").select("*").order("full_name")).data ?? [],
  });

  const members = useMemo(() => {
    const list = [...rawMembers];
    if (!list.some((m) => m.full_name === PRINCE_MEMBER_NAME || m.id === PRINCE_MEMBER_ID)) {
      list.push({
        id: PRINCE_MEMBER_ID,
        full_name: PRINCE_MEMBER_NAME,
        role: "Sales",
        email: "prince@lovable.dev",
        phone: "+250 788 123 456",
        active: true,
      });
    }
    return list;
  }, [rawMembers]);

  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () =>
      (await supabase.from("commissions").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, business_name")).data ?? [],
  });

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchQ = matches(q, m.full_name, m.email, m.phone, m.role);
      const matchRole = roleFilter === "all" || m.role?.toLowerCase() === roleFilter.toLowerCase();
      return matchQ && matchRole;
    });
  }, [members, q, roleFilter]);

  const pendingCommissions = commissions.filter((c) => c.status === "Pending");
  const paidCommissions = commissions.filter((c) => c.status === "Paid");
  const totalPendingAmount = pendingCommissions.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const totalPaidAmount = paidCommissions.reduce((acc, c) => acc + Number(c.amount || 0), 0);

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!memberForm.full_name.trim()) throw new Error("Full name is required");
      const { error } = await supabase.from("team_members").insert({
        full_name: memberForm.full_name.trim(),
        email: memberForm.email || null,
        phone: memberForm.phone || null,
        role: memberForm.role,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team member added");
      setIsAddMemberOpen(false);
      setMemberForm({ full_name: "", email: "", phone: "", role: "Sales" });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCommMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commissions").insert({
        rep_id: commForm.rep_id,
        client_id: commForm.client_id || null,
        amount: Number(commForm.amount),
        type: commForm.type,
        status: commForm.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission record added");
      setIsAddCommissionOpen(false);
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markCommPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commissions").update({ status: "Paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission marked as paid");
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Team Members & Commissions"
      subtitle="Manage internal agency staff, roles, and sales representative deal commissions."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search team members…" />
          <FilterSelect
            label="Role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "all", label: "All Roles" },
              { value: "Sales", label: "Sales" },
              { value: "Dev", label: "Developers" },
              { value: "Support", label: "Support" },
              { value: "Admin", label: "Admin" },
            ]}
          />
          <button
            onClick={() => setIsAddCommissionOpen(true)}
            className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-secondary"
          >
            <Award className="size-4 inline-block mr-1" /> Award Commission
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="gradient-leaf flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-90"
            >
              <Plus className="size-4" /> Add Team Member
            </button>
          )}
        </div>
      }
    >
      <SubTabs tabs={FINANCE_TABS} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Team Staff"
          value={String(members.length)}
          hint="Active agency members"
          tone="plain"
          icon={<Users className="size-4 text-sky-600 dark:text-sky-400" />}
        />
        <Stat
          label="Pending Commissions"
          value={money(totalPendingAmount)}
          hint={`${pendingCommissions.length} deals pending approval`}
          tone="warn"
          icon={<Clock className="size-4 text-amber-600 dark:text-amber-400" />}
        />
        <Stat
          label="Paid Commissions"
          value={money(totalPaidAmount)}
          hint={`${paidCommissions.length} payouts distributed`}
          tone="leaf"
          icon={<Award className="size-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <Stat
          label="Sales Reps"
          value={String(members.filter((m) => m.role === "Sales").length)}
          hint="Commission-earning reps"
          tone="mist"
          icon={<Shield className="size-4 text-purple-600 dark:text-purple-400" />}
        />
      </div>

      {/* Team Members List */}
      <Panel title="Team Roster" right={<Pill tone="plain">{filteredMembers.length} members</Pill>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((m) => {
            const repComms = commissions.filter((c) => c.rep_id === m.id);
            const repEarned = repComms.reduce((acc, c) => acc + Number(c.amount || 0), 0);

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-sm">
                      {m.full_name.slice(0, 2).toUpperCase()}
                    </span>
                    <Pill tone={m.role === "Admin" ? "deep" : m.role === "Sales" ? "leaf" : "mist"}>
                      {m.role || "Staff"}
                    </Pill>
                  </div>
                  <h4 className="mt-3 font-display text-base font-semibold text-foreground">
                    {m.full_name}
                  </h4>
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {m.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3 text-muted-foreground" /> {m.email}
                      </p>
                    )}
                    {m.phone && <p className="truncate">Tel: {m.phone}</p>}
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Commissions earned:</span>
                  <span className="font-mono font-bold text-foreground">{money(repEarned)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Commissions Ledger */}
      <Panel
        title="Commissions Ledger"
        right={<Pill tone="mist">{commissions.length} entries</Pill>}
      >
        {commissions.length === 0 ? (
          <Empty>No commissions logged yet. Award a commission to a rep upon deal signing.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <TH>Team Rep</TH>
                  <TH>Client / Deal</TH>
                  <TH>Type</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {commissions.map((c) => {
                  const repObj = members.find((m) => m.id === c.rep_id);
                  const clientObj = clients.find((x) => x.id === c.client_id);

                  return (
                    <tr key={c.id} className="hover:bg-card/50 transition">
                      <TD>
                        <span className="font-semibold text-foreground">
                          {repObj?.full_name || "Sales Rep"}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-muted-foreground">
                          {clientObj?.business_name || "General Lead / Referral"}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-xs text-muted-foreground">
                          {c.type || "Signing Bonus"}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono font-semibold text-foreground">
                          {money(c.amount)}
                        </span>
                      </TD>
                      <TD>
                        <Pill tone={c.status === "Paid" ? "leaf" : "warn"}>{c.status}</Pill>
                      </TD>
                      <TD className="text-right">
                        {c.status !== "Paid" && isAdmin && (
                          <button
                            onClick={() => markCommPaidMutation.mutate(c.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-secondary"
                          >
                            <CheckCircle2 className="size-3" /> Mark Paid
                          </button>
                        )}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">Add Team Member</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Register an agency staff member or sales representative.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                <input
                  value={memberForm.full_name}
                  onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                  placeholder="e.g. Marc Kwizera"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Role</label>
                <select
                  value={memberForm.role}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      role: e.target.value as "Sales" | "Dev" | "Support" | "Admin",
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Sales">Sales Rep</option>
                  <option value="Dev">Developer / Builder</option>
                  <option value="Support">Support</option>
                  <option value="Admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="name@agency.com"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                <input
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="+250 788 000 000"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => addMemberMutation.mutate()}
                disabled={addMemberMutation.isPending}
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {addMemberMutation.isPending ? "Adding…" : "Save Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award Commission Modal */}
      {isAddCommissionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="surface-card w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">Award Commission</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Attribute deal commission to a sales representative.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Sales Rep</label>
                <select
                  value={commForm.rep_id}
                  onChange={(e) => setCommForm({ ...commForm, rep_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Linked Client</label>
                <select
                  value={commForm.client_id}
                  onChange={(e) => setCommForm({ ...commForm, client_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No client (General Bonus)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
                <input
                  type="number"
                  value={commForm.amount}
                  onChange={(e) => setCommForm({ ...commForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Type</label>
                <select
                  value={commForm.type}
                  onChange={(e) => setCommForm({ ...commForm, type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Signing Bonus">Signing Bonus</option>
                  <option value="Recurring %">Recurring %</option>
                  <option value="Referral Reward">Referral Reward</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setIsAddCommissionOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => addCommMutation.mutate()}
                disabled={addCommMutation.isPending}
                className="gradient-leaf rounded-xl px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {addCommMutation.isPending ? "Saving…" : "Award Commission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
