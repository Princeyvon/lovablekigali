import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GRACE_DAYS, dueState, paidThrough } from "@/lib/agency";

/**
 * Single shared source of truth for client billing standing.
 * Every page (dashboard, billing, app status, clients) derives its figures
 * from here so numbers never disagree between screens.
 */

export type ClientRow = {
  id: string;
  business_name: string;
  status: string;
  signed_date: string | null;
  app_status: string | null;
  app_url: string | null;
  [k: string]: unknown;
};

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      ((await supabase.from("clients").select("*").order("business_name")).data ?? []) as ClientRow[],
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () =>
      (await supabase.from("payments").select("*").order("payment_date", { ascending: false })).data ?? [],
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subs"],
    queryFn: async () => (await supabase.from("subscriptions").select("*")).data ?? [],
  });
}

export type StandingRow = ReturnType<typeof buildStanding>[number];

export function buildStanding(
  clients: ClientRow[],
  payments: { client_id: string; covers_period_end: string; amount: number }[],
  subs: { client_id: string; monthly_rate: number; status: string }[],
  lastReminderByClient: Record<string, string | null> = {},
) {
  return clients
    .map((c) => {
      const mine = payments.filter((p) => p.client_id === c.id);
      const through = paidThrough(mine);
      const state = dueState(through, lastReminderByClient[c.id] ?? null);
      const rate = Number(subs.find((s) => s.client_id === c.id)?.monthly_rate ?? 0);
      const monthsUnpaid = state.overdue ? Math.max(1, Math.ceil(state.daysOverdue / 30)) : 0;
      return {
        ...c,
        ...state,
        rate,
        monthsUnpaid,
        /** Money we are owed by this client right now. */
        owed: rate * monthsUnpaid,
        pastGrace: state.daysOverdue >= GRACE_DAYS,
        collected: mine.reduce((s, p) => s + Number(p.amount ?? 0), 0),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export function summarise(rows: ReturnType<typeof buildStanding>) {
  const active = rows.filter((r) => r.status === "Active");
  const overdue = rows.filter((r) => r.overdue);
  const pastGrace = rows.filter((r) => r.pastGrace);
  return {
    activeCount: active.length,
    mrr: active.reduce((s, r) => s + r.rate, 0),
    overdue,
    pastGrace,
    /** Expected revenue = money owed by apps already past the grace window. */
    expectedRevenue: pastGrace.reduce((s, r) => s + r.owed, 0),
    totalOwed: overdue.reduce((s, r) => s + r.owed, 0),
    collected: rows.reduce((s, r) => s + r.collected, 0),
  };
}
