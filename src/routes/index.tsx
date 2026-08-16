import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Lovable Solutions — Run the agency that builds systems" },
      {
        name: "description",
        content: "Clients, credentials, billing, commissions and insights in one audited internal platform.",
      },
      { property: "og:title", content: "Lovable Solutions" },
      { property: "og:description", content: "Internal operations platform for a digital-solutions agency." },
    ],
  }),
  component: () => null,
});
