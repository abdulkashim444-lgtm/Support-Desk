import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canWrite } from "@/lib/org-context";
import { Plus, Inbox } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Priority = Database["public"]["Enums"]["ticket_priority"];
type Status = Database["public"]["Enums"]["ticket_status"];

export const Route = createFileRoute("/_authenticated/tickets/")({
  component: TicketList,
});

const priorityStyles: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-warning/20 text-warning-foreground",
  urgent: "bg-destructive/10 text-destructive",
};

const statusStyles: Record<Status, string> = {
  open: "bg-primary/10 text-primary",
  pending: "bg-warning/20 text-warning-foreground",
  solved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

function TicketList() {
  const { currentOrg, currentRole } = useOrg();
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, subject, status, priority, requester_name, created_at, updated_at")
        .eq("org_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Inbox</p>
          <h1 className="mt-1 font-display text-4xl">Tickets</h1>
        </div>
        {canWrite(currentRole) && (
          <Link to="/tickets/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New ticket
          </Link>
        )}
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading tickets…</div>
        ) : tickets && tickets.length > 0 ? (
          <ul className="divide-y divide-border">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link to="/tickets/$id" params={{ id: t.id }}
                  className="grid grid-cols-[90px_100px_1fr_auto] items-center gap-4 px-5 py-3.5 text-sm hover:bg-secondary/40">
                  <span className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${priorityStyles[t.priority]}`}>{t.priority}</span>
                  <span className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyles[t.status]}`}>{t.status}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">{t.requester_name ?? "Internal"}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No tickets yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              When customers reach out, their tickets land here. Create a test ticket to see the flow.
            </p>
            {canWrite(currentRole) && (
              <Link to="/tickets/new"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Create ticket
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
