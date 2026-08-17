import { Link, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  Gauge,
  LogOut,
  ScrollText,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserSquare2,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const manage = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/prospects", label: "Prospects", icon: Send },
  { to: "/clients", label: "Clients", icon: UserSquare2 },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/apps", label: "App Status", icon: ShieldAlert },
] as const;

const operate = [
  { to: "/finance/team", label: "Finance", icon: Wallet },
  { to: "/profile", label: "My Profile", icon: UserCog },
] as const;

const adminOnly = [
  { to: "/admin/access", label: "Access Control", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
] as const;

function NavGroup({ label, items, pathname }: { label: string; items: readonly { to: string; label: string; icon: typeof Gauge }[]; pathname: string }) {
  return (
    <div className="mt-6">
      <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
        {label}
      </p>
      <nav className="mt-2 space-y-1">
        {items.map((item) => {
          const section = item.to.startsWith("/finance") ? "/finance" : item.to;
          const active = pathname === section || pathname.startsWith(section + "/");
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

  return (
    <div className="gradient-page min-h-screen p-3 md:p-6">
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
          <header className="surface-card gradient-halo mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5 pr-20 lg:pr-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3">{actions}</div>
          </header>
          {isSales ? <SalesSubTabs /> : null}
          <div className="space-y-6 pb-28 lg:pb-10">{children}</div>
        </main>
      </div>
      <ProfileBadge />
      <BottomNav />
    </div>
  );
}
