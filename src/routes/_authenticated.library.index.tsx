import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/library/")({
  beforeLoad: () => {
    throw redirect({ to: "/library/skills" });
  },
});
