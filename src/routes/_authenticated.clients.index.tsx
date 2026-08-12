import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate, money, paidThrough } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — Agency OS" },
      { name: "description", content: "Signed clients, who onboarded them, and their billing standing." },
      { property: "og:title", content: "Clients — Agency OS" },
      { property: "og:description", content: "Every signed client with owner, status and paid-through date." },
    ],
  }),
  component: Clients,
});

function Clients() {
  const qc = useQueryClient();
  const { role, memberId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ business_name: "", industry: "", contact_name: "", contact_email: "" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("*").order("signed_date", { ascending: false })).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("team_members").select("id, full_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("client_id, covers_period_end, amount")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("client_id, monthly_rate, status")).data ?? [],
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

  return (
    <AppShell
      title="Clients"
      subtitle="Signed relationships, owner-credited and audited."
      actions={
        role === "admin" ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="gradient-leaf rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {open ? "Close" : "New client"}
          </button>
        ) : null
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

      <Panel title={`${clients.length} clients`}>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : clients.length === 0 ? (
          <Empty>No clients yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>Business</TH>
                <TH>Industry</TH>
                <TH>Onboarded by</TH>
                <TH>Monthly</TH>
                <TH>Paid through</TH>
                <TH>Status</TH>
                <TH />
              </>
            }
          >
            {clients.map((c) => {
              const through = paidThrough(payments.filter((p) => p.client_id === c.id));
              const rate = subs.find((s) => s.client_id === c.id)?.monthly_rate;
              return (
                <tr key={c.id} className="transition hover:bg-secondary/50">
                  <TD className="font-medium">{c.business_name}</TD>
                  <TD className="text-muted-foreground">{c.industry || "—"}</TD>
                  <TD>{members.find((m) => m.id === c.onboarded_by)?.full_name ?? "—"}</TD>
                  <TD>{rate ? money(rate) : "—"}</TD>
                  <TD>{fmtDate(through)}</TD>
                  <TD>
                    <Pill tone={c.status === "Active" ? "leaf" : c.status === "Paused" ? "mist" : "warn"}>
                      {c.status}
                    </Pill>
                  </TD>
                  <TD className="text-right">
                    <Link
                      to="/clients/$id"
                      params={{ id: c.id }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
