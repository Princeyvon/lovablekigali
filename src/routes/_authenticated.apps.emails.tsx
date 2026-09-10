import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Copy, Eye, KeyRound, Mail, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";
import { APP_TABS } from "@/routes/_authenticated.apps";
import { Empty, Panel, Pill, Stat } from "@/components/dash";
import { SearchInput, matches } from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, todayISO } from "@/lib/agency";
import { revealAccountPassword, saveAccountPassword } from "@/lib/emails.functions";

export const Route = createFileRoute("/_authenticated/apps/emails")({
  head: () => ({
    meta: [
      { title: "Lovable email accounts — Lovable Solutions" },
      { name: "description", content: "Every Lovable account, its credits, password and the client projects living on it." },
      { property: "og:title", content: "Lovable email accounts — Lovable Solutions" },
      { property: "og:description", content: "Track credits per account and move client projects between accounts." },
    ],
  }),
  component: Emails,
});

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type Draft = {
  id?: string;
  email: string;
  label: string;
  plan: string;
  recovery_email: string;
  credits_remaining: string;
  notes: string;
  password: string;
};

const empty: Draft = {
  email: "",
  label: "",
  plan: "",
  recovery_email: "",
  credits_remaining: "0",
  notes: "",
  password: "",
};

function Emails() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [move, setMove] = useState({ client_id: "", to: "", note: "" });

  const reveal = useServerFn(revealAccountPassword);
  const savePw = useServerFn(saveAccountPassword);

  const { data: accounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: async () => (await supabase.from("lovable_accounts").select("*").order("email")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ["project-transfers"],
    queryFn: async () =>
      (await supabase.from("project_transfers").select("*").order("moved_at", { ascending: false })).data ?? [],
  });

  const visible = useMemo(
    () => accounts.filter((a) => matches(q, a.email, a.label, a.plan, a.notes)),
    [accounts, q],
  );
  const totalCredits = accounts.reduce((s, a) => s + Number(a.credits_remaining ?? 0), 0);
  const unassigned = clients.filter((c) => !c.hosting_account_id).length;
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.email ?? "—";

  const saveAccount = useMutation({
    mutationFn: async (d: Draft) => {
      const row = {
        email: d.email.trim().toLowerCase(),
        label: d.label || null,
        plan: d.plan || null,
        recovery_email: d.recovery_email || null,
        credits_remaining: Number(d.credits_remaining || 0),
        credits_checked_at: todayISO(),
        notes: d.notes || null,
      };
      const res = d.id
        ? await supabase.from("lovable_accounts").update(row).eq("id", d.id).select("id").single()
        : await supabase.from("lovable_accounts").insert(row).select("id").single();
      if (res.error) throw new Error(res.error.message);
      if (d.password) await savePw({ data: { id: res.data.id, password: d.password } });
    },
    onSuccess: () => {
      setDraft(null);
      toast.success("Account saved");
      qc.invalidateQueries({ queryKey: ["lovable-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveProject = useMutation({
    mutationFn: async () => {
      const client = clients.find((c) => c.id === move.client_id);
      if (!client || !move.to) throw new Error("Pick a project and a destination account");
      const from = client.hosting_account_id ?? null;
      const upd = await supabase.from("clients").update({ hosting_account_id: move.to }).eq("id", client.id);
      if (upd.error) throw new Error(upd.error.message);
      const log = await supabase.from("project_transfers").insert({
        client_id: client.id,
        from_account_id: from,
        to_account_id: move.to,
        note: move.note || null,
      });
      if (log.error) throw new Error(log.error.message);
    },
    onSuccess: () => {
      setMove({ client_id: "", to: "", note: "" });
      toast.success("Project moved");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["project-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const show = async (id: string) => {
    try {
      const res = await reveal({ data: { id } });
      if (!res.password) return toast.info("No password saved for this account");
      setShown((s) => ({ ...s, [id]: res.password }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell
      title="App status"
      subtitle="Lovable accounts, credits and where each client project is hosted."
      actions={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search accounts…" />
          {isAdmin ? (
            <button
              onClick={() => setDraft(empty)}
              className="gradient-leaf inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Add account
            </button>
          ) : null}
        </div>
      }
    >
      <SubTabs tabs={APP_TABS} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Accounts" value={String(accounts.length)} tone="leaf" />
        <Stat label="Credits left" value={totalCredits.toLocaleString("en-US")} hint="Across all accounts" tone="mist" />
        <Stat label="Projects hosted" value={String(clients.length - unassigned)} tone="deep" />
        <Stat label="Unassigned projects" value={String(unassigned)} hint="No account set" tone="mist" />
      </div>

      {draft ? (
        <Panel title={draft.id ? "Edit account" : "New account"}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Email
              <input className={field + " mt-1"} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Label
              <input className={field + " mt-1"} placeholder="e.g. Main build account" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Password
              <input className={field + " mt-1"} type="password" placeholder={draft.id ? "Leave blank to keep" : ""} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Recovery email
              <input className={field + " mt-1"} value={draft.recovery_email} onChange={(e) => setDraft({ ...draft, recovery_email: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Plan
              <input className={field + " mt-1"} placeholder="Free / Pro" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Credits remaining
              <input className={field + " mt-1"} inputMode="numeric" value={draft.credits_remaining} onChange={(e) => setDraft({ ...draft, credits_remaining: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-muted-foreground md:col-span-2">
              Notes
              <textarea className={field + " mt-1"} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => saveAccount.mutate(draft)}
              disabled={!draft.email}
              className="gradient-leaf rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save account
            </button>
            <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.length === 0 ? (
          <Panel title="Accounts">
            <Empty>No email accounts saved yet.</Empty>
          </Panel>
        ) : null}
        {visible.map((a) => {
          const hosted = clients.filter((c) => c.hosting_account_id === a.id);
          return (
            <section key={a.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-display text-base font-semibold">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="truncate">{a.email}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.label || "No label"}
                    {a.plan ? ` · ${a.plan}` : ""}
                    {a.credits_checked_at ? ` · checked ${fmtDate(a.credits_checked_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="leaf">{Number(a.credits_remaining ?? 0).toLocaleString("en-US")} credits</Pill>
                  {isAdmin ? (
                    <button
                      aria-label="Edit account"
                      onClick={() =>
                        setDraft({
                          id: a.id,
                          email: a.email,
                          label: a.label ?? "",
                          plan: a.plan ?? "",
                          recovery_email: a.recovery_email ?? "",
                          credits_remaining: String(a.credits_remaining ?? 0),
                          notes: a.notes ?? "",
                          password: "",
                        })
                      }
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {isAdmin ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm">
                  <KeyRound className="size-4 text-muted-foreground" />
                  <span className="numeric min-w-0 flex-1 truncate">{shown[a.id] ?? "••••••••••"}</span>
                  {shown[a.id] ? (
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(shown[a.id]!);
                        toast.success("Password copied");
                      }}
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => void show(a.id)} className="rounded-lg border border-border px-2 py-1 text-xs">
                      <Eye className="size-3.5" />
                    </button>
                  )}
                </div>
              ) : null}

              {a.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p> : null}

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Projects on this account ({hosted.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hosted.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None yet.</span>
                ) : (
                  hosted.map((c) => (
                    <Link
                      key={c.id}
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                    >
                      {c.project_name || c.business_name}
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {isAdmin ? (
        <Panel title="Move a project to another account">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <select
              value={move.client_id}
              onChange={(e) => setMove({ ...move, client_id: e.target.value })}
              className={field}
            >
              <option value="">Project…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.project_name || c.business_name}
                </option>
              ))}
            </select>
            <select value={move.to} onChange={(e) => setMove({ ...move, to: e.target.value })} className={field}>
              <option value="">Move to account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
            <input
              className={field}
              placeholder="Reason (optional)"
              value={move.note}
              onChange={(e) => setMove({ ...move, note: e.target.value })}
            />
            <button
              onClick={() => moveProject.mutate()}
              disabled={!move.client_id || !move.to}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <ArrowRightLeft className="size-4" /> Move
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Destination accounts must already exist above. Every move is recorded below.
          </p>
        </Panel>
      ) : null}

      <Panel title="Transfer history" right={<Pill tone="mist">{transfers.length}</Pill>}>
        {transfers.length === 0 ? (
          <Empty>No project has been moved yet.</Empty>
        ) : (
          <div className="space-y-2">
            {transfers.slice(0, 30).map((t) => {
              const c = clients.find((x) => x.id === t.client_id);
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{c?.project_name || c?.business_name || "Project"}</span>
                  <span className="text-muted-foreground">{nameOf(t.from_account_id)}</span>
                  <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{nameOf(t.to_account_id)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(t.moved_at)}</span>
                  {t.note ? <span className="w-full text-xs text-muted-foreground">{t.note}</span> : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
