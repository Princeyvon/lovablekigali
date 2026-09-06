/**
 * Page catalogue used by Access control. Every page/subpage the app exposes has
 * a stable key; admins can switch each one on or off per teammate.
 */
export type PageDef = { key: string; label: string; path: string; group: string; adminOnly?: boolean };

export const PAGES: readonly PageDef[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", group: "Overview" },

  { key: "sales.prospects", label: "Prospects", path: "/prospects", group: "Sales" },
  { key: "sales.clients", label: "Clients", path: "/clients", group: "Sales" },
  { key: "sales.billing", label: "Billing", path: "/billing", group: "Sales" },

  { key: "apps", label: "App Status", path: "/apps", group: "Delivery" },

  { key: "finance.team", label: "Team", path: "/finance/team", group: "Finance" },
  { key: "finance.transactions", label: "Transactions", path: "/finance/transactions", group: "Finance" },
  { key: "finance.payouts", label: "Payouts", path: "/finance/payouts", group: "Finance" },
  { key: "finance.expenses", label: "Expenses", path: "/finance/expenses", group: "Finance" },
  { key: "finance.analytics", label: "Analytics", path: "/finance/analytics", group: "Finance" },
  { key: "finance.reports", label: "Reports", path: "/finance/reports", group: "Finance" },

  { key: "library.skills", label: "Skills", path: "/library/skills", group: "Library" },
  { key: "library.themes", label: "UI Themes", path: "/library/themes", group: "Library" },
  { key: "library.prompts", label: "Prompts", path: "/library/prompts", group: "Library" },

  { key: "notifications", label: "Notifications", path: "/notifications", group: "Personal" },
  { key: "profile", label: "My profile", path: "/profile", group: "Personal" },

  { key: "admin.access", label: "Access control", path: "/admin/access", group: "Admin", adminOnly: true },
  { key: "admin.audit", label: "Audit log", path: "/admin/audit", group: "Admin", adminOnly: true },
] as const;

export const PAGE_GROUPS = Array.from(new Set(PAGES.map((p) => p.group)));

/** Keys everyone keeps regardless of the rules, so nobody gets locked out. */
export const ALWAYS_ALLOWED = new Set(["profile", "notifications"]);

export function canAccess(key: string, role: string | null, denied: Set<string>) {
  if (role === "admin") return true;
  const page = PAGES.find((p) => p.key === key);
  if (page?.adminOnly) return false;
  if (ALWAYS_ALLOWED.has(key)) return true;
  return !denied.has(key);
}

/** Maps a pathname onto the page key that guards it. */
export function pageKeyForPath(pathname: string) {
  const hit = [...PAGES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((p) => pathname === p.path || pathname.startsWith(p.path + "/"));
  return hit?.key ?? null;
}
