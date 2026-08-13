import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Pill, TD, TH, Table } from "@/components/dash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Agency OS" },
      { name: "description", content: "Every credential reveal, role change and sensitive action, timestamped." },
      { property: "og:title", content: "Audit log — Agency OS" },
      { property: "og:description", content: "Immutable trail of sensitive activity." },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { role } = useAuth();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () =>
      (await supabase.from("entity_events").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const { data: reveals = [] } = useQuery({
    queryKey: ["cred-log"],
    queryFn: async () =>
      (await supabase.from("credential_access_log").select("*").order("accessed_at", { ascending: false }).limit(100))
        .data ?? [],
  });

  if (role !== "admin") {
    return (
      <AppShell title="Audit log" subtitle="Restricted area.">
        <Panel>
          <Empty>Only admins can read the audit trail.</Empty>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Audit log" subtitle="Append-only record of sensitive activity.">
      <Panel title="Activity" right={<Pill tone="mist">{events.length} events</Pill>}>
        {events.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>When</TH>
                <TH>Table</TH>
                <TH>Action</TH>
                <TH>Reason</TH>
              </>
            }
          >
            {events.map((e) => (
              <tr key={e.id}>
                <TD>{fmtDate(e.created_at)}</TD>
                <TD className="font-medium">{e.entity_table}</TD>
                <TD>
                  <Pill tone="leaf">{e.action}</Pill>
                </TD>
                <TD className="text-muted-foreground">{e.change_reason ?? "—"}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Credential reveals" right={<Pill tone="warn">{reveals.length}</Pill>}>
        {reveals.length === 0 ? (
          <Empty>No credential has been revealed yet.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>When</TH>
                <TH>Action</TH>
              </>
            }
          >
            {reveals.map((r) => (
              <tr key={r.id}>
                <TD>{fmtDate(r.accessed_at)}</TD>
                <TD>{r.action}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </AppShell>
  );
}
