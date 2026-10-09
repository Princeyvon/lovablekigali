import { createFileRoute, Outlet } from "@tanstack/react-router";

export const LIBRARY_TABS = [
  { to: "/library/skills", label: "Skills & System Specs" },
  { to: "/library/inspo", label: "Dashboard Inspo" },
  { to: "/library/prompts", label: "Text Prompts" },
  { to: "/library/audit", label: "Audit & Event Log" },
] as const;

export const Route = createFileRoute("/_authenticated/library")({
  component: () => <Outlet />,
});
