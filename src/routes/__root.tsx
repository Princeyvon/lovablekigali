import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import "@/styles.css";
import { warmDatabaseCache, onDbSync } from "@/lib/database-interconnect";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Agency Hub" },
      {
        name: "description",
        content:
          "Internal operations platform for managing clients, credentials vault, billing, commissions, payouts, and performance insights.",
      },
      { property: "og:title", content: "Agency Hub" },
      {
        property: "og:description",
        content:
          "Internal operations platform for managing clients, credentials vault, billing, commissions, payouts, and performance insights.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    // 1. Pre-warm database caches on client mount for instant (<30ms) page loads
    void warmDatabaseCache();

    // 2. Interconnect all queries across tabs and views
    const unsubscribe = onDbSync((event) => {
      if (
        event.type === "project_stage_changed" ||
        event.type === "workflow_advanced" ||
        event.type === "bulk_sync_completed"
      ) {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      }
      if (event.type === "project_environments_updated" || event.type === "bulk_sync_completed") {
        queryClient.invalidateQueries({ queryKey: ["all-project-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["lovable-accounts"] });
      }
      if (
        event.type === "account_password_updated" ||
        event.type === "account_created_or_updated"
      ) {
        queryClient.invalidateQueries({ queryKey: ["lovable-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["all-project-accounts"] });
      }
      if (event.type === "client_updated") {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Toaster richColors position="bottom-right" closeButton />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
