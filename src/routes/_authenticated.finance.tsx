import { createFileRoute, Outlet } from "@tanstack/react-router";

export const FINANCE_TABS = [
  { to: "/finance/team", label: "Team & Commissions" },
  { to: "/finance/payouts", label: "Team Payouts" },
  { to: "/finance/expenses", label: "Expenses" },
  { to: "/finance/insights", label: "Insights & Velocity" },
] as const;

export const Route = createFileRoute("/_authenticated/finance")({
  component: () => <Outlet />,
});
