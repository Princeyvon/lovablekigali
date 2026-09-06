import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pageKeyForPath } from "@/lib/access";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="gradient-page flex min-h-screen items-center justify-center p-6">
      <div className="surface-card max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { session, loading, active, can, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="gradient-page flex min-h-screen items-center justify-center">
        <div className="surface-card px-8 py-6 text-sm text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  if (!active) {
    return (
      <Notice
        title="Account deactivated"
        body="An administrator has switched off your access. Get in touch with them to be reactivated."
        action={
          <button
            onClick={() => void signOut()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign out
          </button>
        }
      />
    );
  }

  const key = pageKeyForPath(pathname);
  if (key && !can(key)) {
    return (
      <Notice
        title="No access to this page"
        body="Your account isn't allowed to open this section. An administrator can change that in Access control."
        action={
          <button
            onClick={() => void navigate({ to: "/dashboard" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to dashboard
          </button>
        }
      />
    );
  }

  return <Outlet />;
}
