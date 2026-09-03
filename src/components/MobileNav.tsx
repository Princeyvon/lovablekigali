import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookMarked,
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
    <div className="surface-card sticky top-3 z-30 mb-4 flex gap-1 p-1.5 md:top-6">
      {SALES_TABS.map((t) => {
        const active = pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
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

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const next = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);
  const toggle = () => {
    setDark((v) => {
      const next = !v;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

/** Overdue clients drive the notification count. */
function useAlerts() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("business_name")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  return useMemo(() => {
    return clients
      .map((c) => {
        const through = paidThrough(payments.filter((p) => p.client_id === c.id));
        const state = dueState(through ?? c.signed_date, null);
        return { id: c.id, name: c.business_name, ...state };
      })
      .filter((r) => r.overdue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [clients, payments]);
}

export function ProfileBadge({ variant = "fixed" }: { variant?: "fixed" | "inline" }) {
  const { user, role, signOut } = useAuth();
  const [menu, setMenu] = useState<null | "profile" | "bell">(null);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const { dark, toggle } = useTheme();
  const alerts = useAlerts();
  const close = () => setMenu(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  return (
    <div
      ref={ref}
      className={cn("z-50", variant === "fixed" ? "fixed right-3 lg:hidden" : "relative")}
      style={variant === "fixed" ? { top: "max(0.75rem, env(safe-area-inset-top))" } : undefined}
    >
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card/85 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_36px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMenu((m) => (m === "bell" ? null : "bell"))}
          aria-label={`Notifications${alerts.length ? `, ${alerts.length} unread` : ""}`}
          aria-expanded={menu === "bell"}
          style={{ touchAction: "manipulation" }}
          className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors active:scale-95 hover:bg-secondary hover:text-foreground"
        >
          <Bell className="size-[18px]" strokeWidth={1.8} />
          {alerts.length ? (
            <span className="numeric absolute -right-0.5 -top-0.5 flex min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-[17px] text-destructive-foreground">
              {alerts.length > 99 ? "99+" : alerts.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          style={{ touchAction: "manipulation" }}
          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors active:scale-95 hover:bg-secondary hover:text-foreground"
        >
          {dark ? <Sun className="size-[18px]" strokeWidth={1.8} /> : <Moon className="size-[18px]" strokeWidth={1.8} />}
        </button>

        <button
          type="button"
          onClick={() => setMenu((m) => (m === "profile" ? null : "profile"))}
          aria-label="Account menu"
          aria-expanded={menu === "profile"}
          style={{ touchAction: "manipulation" }}
          className="flex size-9 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold tracking-wide text-secondary-foreground transition-transform active:scale-95"
        >
          {initials}
        </button>
      </div>

      {menu === "bell" ? (
        <div className="surface-card absolute right-0 mt-2 max-h-[60vh] w-72 overflow-y-auto p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {alerts.length ? `${alerts.length} client${alerts.length > 1 ? "s" : ""} overdue` : "Nothing needs you"}
            </p>
          </div>
          <div className="p-1">
            {alerts.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                to="/clients/$id"
                params={{ id: a.id }}
                onClick={close}
                className="flex items-start gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="numeric block text-xs text-muted-foreground">
                    {a.daysOverdue} day{a.daysOverdue === 1 ? "" : "s"} overdue
                    {a.suspendable ? " · past grace" : ""}
                  </span>
                </span>
              </Link>
            ))}
            {!alerts.length ? <p className="px-3 py-4 text-sm text-muted-foreground">All clients are current.</p> : null}
          </div>
          <div className="border-t border-border p-1">
            <Link
              to="/notifications"
              onClick={close}
              className="block rounded-md px-3 py-2.5 text-center text-sm font-semibold text-primary hover:bg-secondary"
            >
              See all notifications
            </Link>
          </div>
        </div>
      ) : null}

      {menu === "profile" ? (
        <div className="surface-card absolute right-0 mt-2 w-60 overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{user?.email?.split("@")[0] ?? "Signed in"}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{role ?? "…"} access</p>
          </div>
          <div className="p-1">
            <Link
              to="/profile"
              onClick={close}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
            >
              <UserCog className="size-4 text-muted-foreground" /> My profile
            </Link>
            <Link
              to="/library/skills"
              onClick={close}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
            >
              <BookMarked className="size-4 text-muted-foreground" /> Library
            </Link>
            {role === "admin" ? (
              <>
                <Link
                  to="/admin/access"
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-secondary"
                >
                  <ShieldCheck className="size-4 text-muted-foreground" /> Access control
                </Link>
                <Link
                  to="/admin/audit"
                  onClick={close}
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
      <div className="mx-3 flex max-w-lg items-stretch gap-0.5 rounded-2xl border border-white/10 bg-[var(--nav)]/95 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_36px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:mx-auto">
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
                active
                  ? "bg-white/10 text-[var(--nav-foreground)]"
                  : "text-[var(--nav-foreground)]/60 hover:text-[var(--nav-foreground)]",
              )}
            >
              <t.icon
                className={cn("size-[18px]", active && "text-[var(--nav-active)]")}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

