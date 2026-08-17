import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CreditCard,
  Gauge,
  LogOut,
  Moon,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  UserSquare2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { dueState, paidThrough } from "@/lib/agency";
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
    <div className="sticky top-2 z-30 mb-4 flex gap-6 border-b border-border lg:hidden">
      {SALES_TABS.map((t) => {
        const active = pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
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
    <div ref={ref} className="relative z-50 shrink-0 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{ touchAction: "manipulation" }}
        className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold tracking-wide text-foreground transition-transform active:scale-95"
      >
        {initials}
      </button>

      {open ? (
        <div className="surface-card absolute right-0 mt-2 w-60 overflow-hidden p-0">
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-3 flex max-w-lg items-stretch gap-0.5 rounded-xl border border-border bg-card/85 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_36px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:mx-auto">
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors duration-200 active:scale-[0.97]",
                active ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              <t.icon className={cn("size-[18px]", active && "text-primary")} strokeWidth={active ? 2.2 : 1.7} />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

