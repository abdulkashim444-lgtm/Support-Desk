import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-context";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Priority = Database["public"]["Enums"]["ticket_priority"];

export const Route = createFileRoute("/_authenticated/tickets/new")({
  component: NewTicket,
});

function NewTicket() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          org_id: currentOrg.id,
          subject,
          description,
          priority,
          requester_name: requesterName || null,
          requester_email: requesterEmail || null,
          created_by: userData.user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-tickets"] });
      toast.success("Ticket created");
      navigate({ to: "/tickets/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <Link to="/tickets" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>
      <h1 className="font-display text-4xl">New ticket</h1>

      <form onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-5">
        <div>
          <label className="mb-1 block text-xs font-medium">Subject</label>
          <input required value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Description</label>
          <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Requester name</label>
            <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Requester email</label>
            <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Creating…" : "Create ticket"}
          </button>
          <Link to="/tickets" className="rounded-md border border-input px-5 py-2 text-sm font-medium hover:bg-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
