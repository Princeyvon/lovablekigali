import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookMarked,
  CreditCard,
  Gauge,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserSquare2,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav, ProfileBadge, SalesSubTabs, useIsSalesSection } from "@/components/MobileNav";
import { cn } from "@/lib/utils";

const manage = [
  { to: "/prospects", label: "Sales", icon: UserSquare2 },
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/apps", label: "App Status", icon: ShieldAlert },
] as const;

const operate = [
  { to: "/finance/team", label: "Finance", icon: Wallet },
  { to: "/library/skills", label: "Library", icon: BookMarked },
] as const;

const adminOnly = [{ to: "/admin/access", label: "Access Control", icon: ShieldCheck }] as const;

function NavGroup({ label, items, pathname }: { label: string; items: readonly { to: string; label: string; icon: typeof Gauge }[]; pathname: string }) {
  return (
    <div className="mt-6">
      <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
        {label}
      </p>
      <nav className="mt-2 space-y-1">
        {items.map((item) => {
          const sections = item.to.startsWith("/finance")
            ? ["/finance"]
            : item.to.startsWith("/library")
              ? ["/library"]
              : item.to.startsWith("/admin")
                ? ["/admin"]
                : item.to === "/prospects"
                  ? ["/prospects", "/clients"]
                  : [item.to];
          const active = sections.some((s) => pathname === s || pathname.startsWith(s + "/"));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-card text-foreground shadow-[0_10px_25px_-15px_rgba(0,0,0,0.6)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  active ? "gradient-leaf text-primary-foreground" : "bg-white/5 text-current",
                )}
              >
                <item.icon className="size-4" />
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, role, signOut } = useAuth();
  const isSales = useIsSalesSection();

  return (
    <div className="gradient-page min-h-screen px-4 pb-4 pt-5 md:p-6">
      <div className="mx-auto flex max-w-[1500px] gap-6">
        <aside className="gradient-rail sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-3xl pb-4 pt-6 shadow-[var(--shadow-rail)] lg:flex">
          <div className="flex items-center gap-2 px-5">
            <span className="gradient-leaf flex size-9 items-center justify-center rounded-xl text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold text-sidebar-foreground">Lovable Solutions</span>
          </div>
          <div className="mx-5 mt-5 h-px bg-sidebar-border" />
          <div className="flex-1 overflow-y-auto">
            <NavGroup label="Manage" items={manage} pathname={pathname} />
            <NavGroup label="Operate" items={operate} pathname={pathname} />
            {role === "admin" ? <NavGroup label="Admin" items={adminOnly} pathname={pathname} /> : null}
          </div>
          <div className="mx-3 mt-4 overflow-hidden rounded-2xl bg-white/5 p-4">
            <p className="text-sm font-semibold text-sidebar-foreground">
              {user?.email?.split("@")[0] ?? "Signed in"}
            </p>
            <p className="mt-0.5 text-xs capitalize text-sidebar-foreground/60">{role ?? "…"} access</p>
            <button
              onClick={() => void signOut()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:surface-card lg:mb-6 lg:flex lg:flex-wrap lg:justify-between lg:px-6 lg:py-5">
            <div className="min-w-0 pr-36 lg:pr-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:hidden">
                Lovable Solutions
              </p>
              <h1 className="truncate font-display text-[22px] font-semibold tracking-tight lg:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm leading-snug text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden items-center gap-3 lg:flex">{actions}</div>
              <div className="hidden lg:block">
                <ProfileBadge variant="inline" />
              </div>
              <ProfileBadge />
            </div>
            {actions ? <div className="col-span-2 flex flex-wrap items-center gap-3 lg:hidden">{actions}</div> : null}
          </header>

          {isSales ? <SalesSubTabs /> : null}
          <div className="space-y-4 pb-32 sm:space-y-6 lg:pb-10">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

