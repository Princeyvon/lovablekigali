import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type SubTab = { to: string; label: string; exact?: boolean };

/** Shared pill sub-navigation used by Sales, Admin and Library sections. */
export function SubTabs({ tabs, className }: { tabs: readonly SubTab[]; className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      className={cn(
        "surface-card sticky top-3 z-30 mb-4 flex gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] md:top-6 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-medium transition",
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
  );
}
