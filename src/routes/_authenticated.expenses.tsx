import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/expenses")({
  beforeLoad: () => {
    throw redirect({ to: "/finance/expenses" });
  },
});
