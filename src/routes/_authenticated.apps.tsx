import { Outlet, createFileRoute } from "@tanstack/react-router";

export const APP_TABS = [
  { to: "/apps", label: "Delivery", exact: true },
  { to: "/apps/emails", label: "Emails" },
] as const;

export const Route = createFileRoute("/_authenticated/apps")({
  component: () => <Outlet />,
});
