import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Empty, Panel, Pill, Stat, TD, TH, Table } from "@/components/dash";
import {
  DateRangeFilter,
  EMPTY_RANGE,
  FilterSelect,
  SearchInput,
  inRange,
  matches,
  uniqueOptions,
  type DateRange,
} from "@/components/search";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, money } from "@/lib/agency";

export const Route = createFileRoute("/_authenticated/finance/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Finance — Lovable Solutions" },
      { name: "description", content: "Every franc in and out, split across MoMo, bank and cash balances." },
      { property: "og:title", content: "Transactions — Lovable Solutions" },
      { property: "og:description", content: "The complete ledger: payments in, expenses and payouts out." },
    ],
  }),
  component: Transactions,
});

const BUCKETS = [
  { key: "momo", label: "MoMo", test: (m: string) => /momo|mobile/i.test(m) },
  { key: "bank", label: "Bank", test: (m: string) => /bank|check|cheque/i.test(m) },
  { key: "cash", label: "Cash", test: (m: string) => /cash/i.test(m) },
] as const;

function Transactions() {
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: tx = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () =>
      (await supabase.from("transactions").select("*").order("occurred_at", { ascending: false })).data ?? [],
  });

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    const per = { momo: 0, bank: 0, cash: 0, other: 0 };
    for (const t of tx) {
      const amt = Number(t.amount ?? 0);
      const signed = t.direction === "in" ? amt : -amt;
      if (t.direction === "in") inflow += amt;
      else outflow += amt;
      const bucket: keyof typeof per = BUCKETS.find((b) => b.test(t.method ?? ""))?.key ?? "other";
      per[bucket] += signed;
    }
    return { inflow, outflow, net: inflow - outflow, per };
  }, [tx]);

  const visible = useMemo(
    () =>
      tx.filter(
        (t) =>
          (dir === "all" || t.direction === dir) &&
          (category === "all" || t.category === category) &&
          (method === "all" || t.method === method) &&
          inRange(t.occurred_at, range) &&
          matches(q, t.payee, t.category, t.method, t.note),
      ),
    [tx, q, dir, category, method, range],
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net position" value={money(totals.net)} hint={`${tx.length} movements logged`} />
        <Stat label="MoMo balance" value={money(totals.per.momo)} tone="mist" />
        <Stat label="Bank balance" value={money(totals.per.bank)} tone="deep" />
        <Stat label="Cash balance" value={money(totals.per.cash)} tone="leaf" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2">
        <Panel title="Money in">
          <p className="font-display text-3xl font-semibold text-primary">{money(totals.inflow)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Client payments recorded in billing.</p>
        </Panel>
        <Panel title="Money out">
          <p className="font-display text-3xl font-semibold">{money(totals.outflow)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Expenses and team payouts combined.</p>
        </Panel>
      </div>

      <Panel
        title="Ledger"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 rounded-md bg-secondary p-1 text-xs font-medium">
              {(["all", "in", "out"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDir(d)}
                  className={`rounded-sm px-3 capitalize ${dir === d ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <FilterSelect label="Category" value={category} onChange={setCategory} options={uniqueOptions(tx.map((t) => t.category))} />
            <FilterSelect label="Method" value={method} onChange={setMethod} options={uniqueOptions(tx.map((t) => t.method))} />
            <DateRangeFilter value={range} onChange={setRange} />
            <SearchInput value={q} onChange={setQ} placeholder="Search ledger…" />
          </div>
        }
      >
        {isLoading ? (
          <Empty>Loading ledger…</Empty>
        ) : visible.length === 0 ? (
          <Empty>No movements match.</Empty>
        ) : (
          <Table
            head={
              <>
                <TH>When</TH>
                <TH>Direction</TH>
                <TH>Payee / source</TH>
                <TH>Category</TH>
                <TH>Method</TH>
                <TH className="text-right">Amount</TH>
              </>
            }
          >
            {visible.slice(0, 300).map((t) => (
              <tr key={t.id}>
                <TD>{fmtDate(t.occurred_at)}</TD>
                <TD>
                  {t.direction === "in" ? (
                    <Pill tone="leaf">
                      <ArrowDownLeft className="mr-1 size-3" /> In
                    </Pill>
                  ) : (
                    <Pill tone="warn">
                      <ArrowUpRight className="mr-1 size-3" /> Out
                    </Pill>
                  )}
                </TD>
                <TD className="font-medium">{t.payee ?? t.source_table}</TD>
                <TD className="text-muted-foreground">{t.category}</TD>
                <TD>{t.method}</TD>
                <TD className={`text-right font-medium ${t.direction === "in" ? "text-primary" : ""}`}>
                  {t.direction === "in" ? "+" : "−"}
                  {money(t.amount)}
                </TD>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
