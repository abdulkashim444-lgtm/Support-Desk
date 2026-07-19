import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OrgProvider, useOrg } from "@/lib/org-context";
import { AppShell } from "@/components/app-shell";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: () => (
    <OrgProvider>
      <TicketsLayout />
    </OrgProvider>
  ),
});

function TicketsLayout() {
  const { memberships, isLoading, currentOrg } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && memberships.length === 0) navigate({ to: "/onboarding" });
  }, [isLoading, memberships.length, navigate]);

  if (isLoading || !currentOrg) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
