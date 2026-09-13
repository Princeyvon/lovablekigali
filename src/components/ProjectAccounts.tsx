import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, Github, Link2, Plus, Trash2 } from "lucide-react";
import { Empty, Pill } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  PLATFORMS,
  deleteProjectAccount,
  revealProjectAccount,
  saveProjectAccount,
} from "@/lib/project-accounts.functions";

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const empty = {
  platform: "Lovable" as string,
  email: "",
  username: "",
  url: "",
  password: "",
  notes: "",
  lovable_account_id: "",
};

/**
 * Every platform account (Lovable, Google AI Studio, Manus, GitHub, …) attached
 * to each project a client owns. One client can have many projects, and one
 * project can sit on several platforms under different emails.
 */
export function ProjectAccounts({ clientId, projectId }: { clientId?: string; projectId?: string }) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const scope = projectId ?? clientId ?? "";
  const { data: projects = [] } = useQuery({
    queryKey: ["accounts-projects", projectId, clientId],
    queryFn: async () => {
      const base = supabase
        .from("projects")
        .select("id, project_name, build_stage, payment_state, app_url, hosting_account_id");
      const q = projectId ? base.eq("id", projectId) : base.eq("client_id", clientId!);
      return (await q.order("created_at", { ascending: false })).data ?? [];
    },
  });

  const ids = projects.map((p) => p.id);
  const { data: accounts = [] } = useQuery({
    queryKey: ["project-accounts", scope, ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () =>
      (await supabase.from("project_accounts").select("*").in("project_id", ids).order("platform")).data ?? [],
  });
  const { data: lovableAccounts = [] } = useQuery({
    queryKey: ["lovable-accounts"],
    queryFn: async () => (await supabase.from("lovable_accounts").select("id, email, label, credits_remaining")).data ?? [],
  });

  const save = useServerFn(saveProjectAccount);
  const reveal = useServerFn(revealProjectAccount);
  const remove = useServerFn(deleteProjectAccount);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-accounts", scope] });

  const add = useMutation({
    mutationFn: async (projectId: string) =>
      save({ data: { ...form, project_id: projectId, lovable_account_id: form.lovable_account_id || null } }),
    onSuccess: () => {
      toast.success("Account linked");
      setForm(empty);
      setOpenFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (projects.length === 0) return <Empty>No projects for this client yet.</Empty>;

  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const rows = accounts.filter((a) => a.project_id === p.id);
        const hosting = lovableAccounts.find((a) => a.id === p.hosting_account_id);
        return (
          <div key={p.id} className="rounded-2xl border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <p className="font-display text-sm font-semibold">{p.project_name}</p>
              <Pill tone="mist">{p.build_stage}</Pill>
              <Pill tone="muted">{p.payment_state}</Pill>
              {hosting && (
                <span className="text-xs text-muted-foreground">
                  hosted on {hosting.label || hosting.email}
                </span>
              )}
              <button
                onClick={() => {
                  setForm(empty);
                  setOpenFor(openFor === p.id ? null : p.id);
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <Plus className="size-3.5" /> Account
              </button>
            </div>

            {openFor === p.id && (
              <div className="grid gap-2 border-b border-border bg-secondary/40 p-3 sm:grid-cols-3">
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className={field}
                >
                  {PLATFORMS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Account email"
                  className={field}
                />
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Username (optional)"
                  className={field}
                />
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="Link / repo URL"
                  className={field}
                />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password (optional)"
                  className={field}
                />
                {form.platform === "Lovable" ? (
                  <select
                    value={form.lovable_account_id}
                    onChange={(e) => setForm({ ...form, lovable_account_id: e.target.value })}
                    className={field}
                  >
                    <option value="">Link a saved Lovable account…</option>
                    {lovableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label ? `${a.label} · ${a.email}` : a.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notes"
                    className={field}
                  />
                )}
                <button
                  onClick={() => add.mutate(p.id)}
                  disabled={!form.email && !form.url && !form.lovable_account_id}
                  className="gradient-leaf rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-3"
                >
                  Link account
                </button>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No platform accounts linked yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((a) => {
                  const linked = lovableAccounts.find((l) => l.id === a.lovable_account_id);
                  const mail = a.email || linked?.email || "—";
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                      <Pill tone="mist">{a.platform}</Pill>
                      <span className="font-medium">{mail}</span>
                      {a.username && <span className="text-muted-foreground">{a.username}</span>}
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {a.platform === "GitHub" ? <Github className="size-3.5" /> : <Link2 className="size-3.5" />}
                          open
                        </a>
                      )}
                      <div className="ml-auto flex items-center gap-3">
                        {revealed[a.id] ? (
                          <code className="rounded bg-secondary px-2 py-1 text-xs">{revealed[a.id]}</code>
                        ) : (
                          <button
                            onClick={async () => {
                              const res = await reveal({ data: { id: a.id } });
                              if (!res.password) return toast.error("No password stored for this account");
                              setRevealed((r) => ({ ...r, [a.id]: res.password }));
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <Eye className="size-3.5" /> Reveal
                          </button>
                        )}
                        {revealed[a.id] && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(revealed[a.id]!);
                              toast.success("Copied");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => drop.mutate(a.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
