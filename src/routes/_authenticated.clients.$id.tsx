import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, paidThrough } from "@/lib/agency";
import { revealCredential, saveCredential } from "@/lib/vault.functions";

const TABS = ["Overview", "Notes", "Service Log", "System Users", "Credentials", "Billing"] as const;

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client detail — Agency OS" },
      { name: "description", content: "Overview, notes, service log, system users, credentials and billing for a client." },
      { property: "og:title", content: "Client detail — Agency OS" },
      { property: "og:description", content: "Everything known about one client relationship." },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { memberId, role } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["notes", id],
    queryFn: async () =>
      (await supabase.from("client_notes").select("*").eq("client_id", id).order("created_at", { ascending: false }))
        .data ?? [],
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["logs", id],
    queryFn: async () =>
      (await supabase.from("service_logs").select("*").eq("client_id", id).order("date", { ascending: false })).data ??
      [],
  });
  const { data: sysUsers = [] } = useQuery({
    queryKey: ["sysusers", id],
    queryFn: async () => (await supabase.from("client_system_users").select("*").eq("client_id", id)).data ?? [],
  });
  const { data: creds = [] } = useQuery({
    queryKey: ["creds", id],
    queryFn: async () =>
      (await supabase.from("client_credentials").select("id, service_name, username, last_rotated, notes").eq("client_id", id))
        .data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () =>
      (await supabase.from("payments").select("*").eq("client_id", id).order("payment_date", { ascending: false }))
        .data ?? [],
  });
  const { data: sub } = useQuery({
    queryKey: ["client-sub", id],
    queryFn: async () => (await supabase.from("subscriptions").select("*").eq("client_id", id).maybeSingle()).data,
  });

  const [note, setNote] = useState({ content: "", note_type: "General" as const, is_draft: false });
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_notes")
        .insert({ client_id: id, content: note.content, note_type: note.note_type, is_draft: note.is_draft, created_by: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote({ content: "", note_type: "General", is_draft: false });
      qc.invalidateQueries({ queryKey: ["notes", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [log, setLog] = useState({ description: "", category: "Feature" as const });
  const addLog = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_logs")
        .insert({ client_id: id, description: log.description, category: log.category, logged_by: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      setLog({ description: "", category: "Feature" });
      qc.invalidateQueries({ queryKey: ["logs", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useServerFn(saveCredential);
  const reveal = useServerFn(revealCredential);
  const [cred, setCred] = useState({ service_name: "", username: "", password: "", change_reason: "" });
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const addCred = useMutation({
    mutationFn: async () => save({ data: { ...cred, client_id: id } }),
    onSuccess: () => {
      toast.success("Credential encrypted and stored");
      setCred({ service_name: "", username: "", password: "", change_reason: "" });
      qc.invalidateQueries({ queryKey: ["creds", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const through = paidThrough(payments);

  return (
    <AppShell
      title={client?.business_name ?? "Client"}
      subtitle={client ? `${client.industry || "—"} · signed ${fmtDate(client.signed_date)}` : undefined}
      actions={
        <Link to="/clients" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm">
          <ArrowLeft className="size-4" /> All clients
        </Link>
      }
    >
      <div className="surface-card flex flex-wrap gap-1 p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
                : "rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Relationship">
            <dl className="space-y-3 text-sm">
              {[
                ["Contact", client?.contact_name],
                ["Email", client?.contact_email],
                ["Phone", client?.contact_phone],
                ["Status", client?.status],
                ["Signed", fmtDate(client?.signed_date)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{(v as string) || "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="At a glance">
            <div className="grid grid-cols-2 gap-3">
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Paid through</p>
                <p className="mt-1 font-display text-lg font-semibold">{fmtDate(through)}</p>
              </div>
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Monthly rate</p>
                <p className="mt-1 font-display text-lg font-semibold">{money(sub?.monthly_rate)}</p>
              </div>
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Service entries</p>
                <p className="mt-1 font-display text-lg font-semibold">{logs.length}</p>
              </div>
              <div className="gradient-mist rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Vault items</p>
                <p className="mt-1 font-display text-lg font-semibold">{creds.length}</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === "Notes" && (
        <Panel title="Notes & draft prompts">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_140px_auto]">
            <input
              value={note.content}
              onChange={(e) => setNote({ ...note, content: e.target.value })}
              placeholder="Note, prompt draft or spec idea"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={note.note_type}
              onChange={(e) => setNote({ ...note, note_type: e.target.value as typeof note.note_type })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {["General", "Prompt Draft", "Spec"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={note.is_draft}
                onChange={(e) => setNote({ ...note, is_draft: e.target.checked })}
              />
              Draft
            </label>
            <button
              onClick={() => addNote.mutate()}
              disabled={!note.content}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {notes.length === 0 && <Empty>No notes yet.</Empty>}
            {notes.map((n) => (
              <div key={n.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                  <Pill tone="mist">{n.note_type}</Pill>
                  {n.is_draft && <Pill tone="muted">draft</Pill>}
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(n.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{n.content}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "Service Log" && (
        <Panel title="Service log">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input
              value={log.description}
              onChange={(e) => setLog({ ...log, description: e.target.value })}
              placeholder="What was done"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={log.category}
              onChange={(e) => setLog({ ...log, category: e.target.value as typeof log.category })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {["Bug Fix", "Feature", "Maintenance", "Support Call"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => addLog.mutate()}
              disabled={!log.description}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Log
            </button>
          </div>
          <div className="mt-5">
            {logs.length === 0 ? (
              <Empty>Nothing logged yet.</Empty>
            ) : (
              <Table
                head={
                  <>
                    <TH>Date</TH>
                    <TH>Category</TH>
                    <TH>Description</TH>
                  </>
                }
              >
                {logs.map((l) => (
                  <tr key={l.id}>
                    <TD>{fmtDate(l.date)}</TD>
                    <TD>
                      <Pill tone="mist">{l.category}</Pill>
                    </TD>
                    <TD>{l.description}</TD>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Panel>
      )}

      {tab === "System Users" && (
        <Panel title="Client system snapshot">
          {sysUsers.length === 0 ? (
            <Empty>No snapshot recorded.</Empty>
          ) : (
            <Table
              head={
                <>
                  <TH>Users</TH>
                  <TH>Admin</TH>
                  <TH>Roles</TH>
                  <TH>Last verified</TH>
                </>
              }
            >
              {sysUsers.map((s) => (
                <tr key={s.id}>
                  <TD>{s.user_count}</TD>
                  <TD>
                    {s.admin_name} <span className="text-muted-foreground">{s.admin_contact}</span>
                  </TD>
                  <TD>{s.roles_breakdown}</TD>
                  <TD>{fmtDate(s.last_verified_date)}</TD>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "Credentials" && (
        <Panel
          title="Credential vault"
          right={<Pill tone="warn">Every reveal is logged</Pill>}
        >
          {role === "sales" ? (
            <Empty>Sales reps don't have vault access.</Empty>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                {(["service_name", "username", "password", "change_reason"] as const).map((k) => (
                  <input
                    key={k}
                    type={k === "password" ? "password" : "text"}
                    value={cred[k]}
                    onChange={(e) => setCred({ ...cred, [k]: e.target.value })}
                    placeholder={k.replace("_", " ")}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm capitalize"
                  />
                ))}
                <button
                  onClick={() => addCred.mutate()}
                  disabled={!cred.service_name || !cred.password || !cred.change_reason}
                  className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <KeyRound className="mr-1 inline size-4" /> Store
                </button>
              </div>
              <div className="mt-5">
                {creds.length === 0 ? (
                  <Empty>No credentials stored.</Empty>
                ) : (
                  <Table
                    head={
                      <>
                        <TH>Service</TH>
                        <TH>Username</TH>
                        <TH>Password</TH>
                        <TH>Last rotated</TH>
                      </>
                    }
                  >
                    {creds.map((c) => (
                      <tr key={c.id}>
                        <TD className="font-medium">{c.service_name}</TD>
                        <TD>{c.username}</TD>
                        <TD>
                          {revealed[c.id] ? (
                            <code className="rounded bg-secondary px-2 py-1 text-xs">{revealed[c.id]}</code>
                          ) : (
                            <button
                              onClick={async () => {
                                const res = await reveal({ data: { id: c.id } });
                                setRevealed((r) => ({ ...r, [c.id]: res.password }));
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                            >
                              <Eye className="size-3.5" /> Reveal
                            </button>
                          )}
                        </TD>
                        <TD>{fmtDate(c.last_rotated)}</TD>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === "Billing" && (
        <Panel title="Billing">
          <div className="gradient-mist mb-5 rounded-2xl border border-border p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid through</p>
            <p className="mt-1 font-display text-3xl font-semibold">{fmtDate(through)}</p>
          </div>
          {payments.length === 0 ? (
            <Empty>No payments recorded.</Empty>
          ) : (
            <Table
              head={
                <>
                  <TH>Paid on</TH>
                  <TH>Amount</TH>
                  <TH>Months</TH>
                  <TH>Covers</TH>
                </>
              }
            >
              {payments.map((p) => (
                <tr key={p.id}>
                  <TD>{fmtDate(p.payment_date)}</TD>
                  <TD className="font-medium text-primary">{money(p.amount)}</TD>
                  <TD>{p.months_covered}</TD>
                  <TD>
                    {fmtDate(p.covers_period_start)} → {fmtDate(p.covers_period_end)}
                  </TD>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
