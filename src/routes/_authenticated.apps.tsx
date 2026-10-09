import { createFileRoute, Outlet } from "@tanstack/react-router";

export const APP_TABS = [
  { to: "/apps", label: "Overview", exact: true },
  { to: "/apps/projects", label: "Projects & Platforms" },
  { to: "/apps/emails", label: "Emails & Credentials" },
] as const;

export const Route = createFileRoute("/_authenticated/apps")({
  component: () => <Outlet />,
});
