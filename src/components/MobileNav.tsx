import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  Gauge,
  LogOut,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserSquare2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, match: ["/dashboard"] },
  { to: "/prospects", label: "Sales", icon: UserSquare2, match: ["/prospects", "/clients"] },
  { to: "/billing", label: "Billing", icon: CreditCard, match: ["/billing"] },
  { to: "/apps", label: "Apps", icon: ShieldAlert, match: ["/apps"] },
  { to: "/finance/team", label: "Finance", icon: Wallet, match: ["/finance"] },
] as const;

export const SALES_TABS = [
  { to: "/prospects", label: "Prospects" },
  { to: "/clients", label: "Clients" },
] as const;

export function useIsSalesSection() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith("/prospects") || pathname.startsWith("/clients");
}

export function SalesSubTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="surface-card sticky top-2 z-30 mb-4 flex gap-1 rounded-lg p-1 lg:hidden">
      {SALES_TABS.map((t) => {
        const active = pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition",
              active
                ? "gradient-leaf text-primary-foreground"
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

export function ProfileBadge() {
  const { user, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="fixed right-3 top-3 z-50 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="gradient-leaf flex size-11 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_-12px_rgba(0,0,0,0.6)] ring-4 ring-background"
      >
        {initials}
      </button>

      {open ? (
        <div className="surface-card absolute right-0 mt-2 w-60 overflow-hidden rounded-xl p-0 shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{user?.email?.split("@")[0] ?? "Signed in"}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{role ?? "…"} access</p>
          </div>
          <div className="p-1">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
            >
              <UserCog className="size-4 text-muted-foreground" /> My profile
            </Link>
            {role === "admin" ? (
              <>
                <Link
                  to="/admin/access"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
                >
                  <ShieldCheck className="size-4 text-muted-foreground" /> Access control
                </Link>
                <Link
                  to="/admin/audit"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
                >
                  <ScrollText className="size-4 text-muted-foreground" /> Audit log
                </Link>
              </>
            ) : null}
          </div>
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-auto mb-3 flex max-w-lg items-stretch gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur">
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition",
                active ? "gradient-leaf text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <t.icon className="size-5" />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
