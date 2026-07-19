import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { OrgProvider, useOrg } from "@/lib/org-context";
import { Inbox, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <OrgProvider>
      <AppShellGate />
    </OrgProvider>
  ),
});

function AppShellGate() {
  const { memberships, isLoading, currentOrg } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && memberships.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, memberships.length, navigate]);

  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!currentOrg) return null;

  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { currentOrg } = useOrg();
  const { data: stats } = useQuery({
    queryKey: ["ticket-stats", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const [open, pending, solved, total] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", currentOrg!.id).eq("status", "open"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", currentOrg!.id).eq("status", "pending"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", currentOrg!.id).eq("status", "solved"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", currentOrg!.id),
      ]);
      return {
        open: open.count ?? 0,
        pending: pending.count ?? 0,
        solved: solved.count ?? 0,
        total: total.count ?? 0,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-tickets", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, subject, status, priority, created_at, requester_name")
        .eq("org_id", currentOrg!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    { label: "Open", value: stats?.open ?? 0, icon: Inbox, tone: "text-primary" },
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock, tone: "text-warning-foreground" },
    { label: "Solved", value: stats?.solved ?? 0, icon: CheckCircle2, tone: "text-success" },
    { label: "Total", value: stats?.total ?? 0, icon: AlertCircle, tone: "text-muted-foreground" },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Overview</p>
        <h1 className="mt-1 font-display text-4xl">{currentOrg?.name}</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </div>
            <div className="mt-3 font-display text-4xl">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold">Recent tickets</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {recent && recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">{t.requester_name ?? "Internal"} · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize">{t.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No tickets yet. Create your first ticket to see it here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
