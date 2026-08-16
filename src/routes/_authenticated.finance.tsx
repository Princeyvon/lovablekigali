import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/finance/team", label: "Team" },
  { to: "/finance/payouts", label: "Payouts" },
  { to: "/finance/expenses", label: "Expenses" },
  { to: "/finance/analytics", label: "Analytics" },
  { to: "/finance/transactions", label: "Transactions" },
] as const;

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Lovable Solutions" },
      { name: "description", content: "Team, payouts, expenses, analytics and the full transaction ledger in RWF." },
      { property: "og:title", content: "Finance — Lovable Solutions" },
      { property: "og:description", content: "One place for every franc that moves through the business." },
    ],
  }),
  component: FinanceLayout,
});

function FinanceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = TABS.find((t) => pathname.startsWith(t.to));

  return (
    <AppShell title="Finance" subtitle={`${current?.label ?? "Overview"} · all figures in RWF`}>
      <div className="surface-card sticky top-3 z-30 flex gap-1 overflow-x-auto p-1.5 md:top-6">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
                active
                  ? "gradient-leaf text-primary-foreground shadow-[0_10px_20px_-12px_rgba(0,0,0,0.5)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
