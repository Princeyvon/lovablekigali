import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SubTabs } from "@/components/SubTabs";

export const LIBRARY_TABS = [
  { to: "/library/skills", label: "Skills" },
  { to: "/library/themes", label: "UI Themes" },
  { to: "/library/prompts", label: "Prompts" },
] as const;

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Lovable Solutions" },
      { name: "description", content: "Reusable skills, UI theme references and prompts kept in one place." },
      { property: "og:title", content: "Library — Lovable Solutions" },
      { property: "og:description", content: "The stuff you reach for on every build: skills, themes, prompts." },
    ],
  }),
  component: LibraryLayout,
});

function LibraryLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = LIBRARY_TABS.find((t) => pathname.startsWith(t.to));

  return (
    <AppShell title="Library" subtitle={`${current?.label ?? "Saved"} · things you reuse on every build`}>
      <SubTabs tabs={LIBRARY_TABS} />
      <Outlet />
    </AppShell>
  );
}
