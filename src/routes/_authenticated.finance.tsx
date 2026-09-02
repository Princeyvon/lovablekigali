import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/finance/team", label: "Team" },
  { to: "/finance/payouts", label: "Payouts" },
  { to: "/finance/expenses", label: "Expenses" },
  { to: "/finance/analytics", label: "Analytics" },
  { to: "/finance/transactions", label: "Transactions" },
  { to: "/finance/reports", label: "Reports" },
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
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: -1 | 1) => railRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  useEffect(() => {
    railRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <AppShell title="Finance" subtitle={`${current?.label ?? "Overview"} · all figures in RWF`}>
      <div className="sticky top-3 z-30 md:top-6">
        <div className="surface-card flex items-center gap-1 p-1.5">
          <button
            type="button"
            aria-label="Previous tabs"
            onClick={() => scrollBy(-1)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div ref={railRef} className="flex flex-1 gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  data-active={active ? "true" : undefined}
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
          <button
            type="button"
            aria-label="Next tabs"
            onClick={() => scrollBy(1)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {TABS.map((t) => (
            <span
              key={t.to}
              className={cn(
                "h-1.5 rounded-full transition-all",
                pathname.startsWith(t.to) ? "w-5 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      </div>
      <Outlet />
    </AppShell>
  );
}
