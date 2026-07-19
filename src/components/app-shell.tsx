import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Inbox, LayoutDashboard, Users, LogOut, ChevronDown, Building2, Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { memberships, currentOrg, setCurrentOrgId } = useOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function onSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", search: { mode: "signin" as const }, replace: true });
  }

  const nav: Array<{ to: "/app" | "/tickets" | "/members"; label: string; icon: typeof Inbox; exact?: boolean }> = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/tickets", label: "Tickets", icon: Inbox },
    { to: "/members", label: "Team", icon: Users },
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Inbox className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">SupportDesk</span>
        </div>

        {/* Org switcher */}
        <div className="relative px-3 pt-3">
          <button
            onClick={() => setOrgMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-sidebar-border bg-card px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{currentOrg?.name ?? "No workspace"}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {orgMenuOpen && (
            <div className="absolute left-3 right-3 z-10 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-[var(--shadow-elevated)]">
              {memberships.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setCurrentOrgId(m.org_id); setOrgMenuOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary ${
                    m.org_id === currentOrg?.id ? "bg-secondary" : ""
                  }`}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1 truncate">{m.organizations.name}</div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.role}</span>
                </button>
              ))}
              <button
                onClick={() => { setOrgMenuOpen(false); navigate({ to: "/onboarding" }); }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <Plus className="h-4 w-4" /> New workspace
              </button>
            </div>
          )}
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/60"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-[239px] border-t border-sidebar-border p-3">
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}
