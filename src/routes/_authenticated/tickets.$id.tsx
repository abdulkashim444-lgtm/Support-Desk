import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canWrite } from "@/lib/org-context";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["ticket_status"];
type Priority = Database["public"]["Enums"]["ticket_priority"];

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const { currentRole } = useOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = canWrite(currentRole);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["ticket-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("id, body, is_internal, created_at, author_id, profiles:author_id(full_name, email, avatar_url)")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);

  async function updateField(patch: Partial<{ status: Status; priority: Priority }>) {
    const { error } = await supabase.from("tickets").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket-stats"] });
    toast.success("Updated");
  }

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: id,
        author_id: userData.user!.id,
        body: reply.trim(),
        is_internal: isInternal,
      });
      if (error) throw error;
      setReply("");
      setIsInternal(false);
      qc.invalidateQueries({ queryKey: ["ticket-messages", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tickets"] });
    toast.success("Deleted");
    navigate({ to: "/tickets" });
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!ticket) return <div className="p-8 text-sm text-muted-foreground">Not found</div>;

  return (
    <div className="p-8">
      <Link to="/tickets" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="font-display text-3xl">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From {ticket.requester_name ?? "internal"}{ticket.requester_email ? ` · ${ticket.requester_email}` : ""}
          </p>

          {ticket.description && (
            <div className="mt-6 rounded-xl border border-border bg-card p-5 text-sm whitespace-pre-wrap">
              {ticket.description}
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Conversation</h2>
            <ul className="space-y-3">
              {messages?.map((m) => {
                const author = m.profiles as unknown as { full_name?: string; email?: string } | null;
                return (
                  <li key={m.id} className={`rounded-xl border p-4 text-sm ${
                    m.is_internal ? "border-warning/40 bg-warning/10" : "border-border bg-card"
                  }`}>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {author?.full_name ?? author?.email ?? "Agent"}
                      </span>
                      <span className="flex items-center gap-2">
                        {m.is_internal && <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning-foreground"><Lock className="h-3 w-3" /> Internal</span>}
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </li>
                );
              })}
              {messages?.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No replies yet.
                </li>
              )}
            </ul>
          </div>

          {canEdit && (
            <form onSubmit={onPost} className="mt-6 rounded-xl border border-border bg-card p-4">
              <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                className="w-full resize-none bg-transparent text-sm focus:outline-none" />
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Internal note (only agents can see)
                </label>
                <button type="submit" disabled={posting || !reply.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <MessageSquare className="h-4 w-4" /> Post reply
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Properties</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                <select disabled={!canEdit} value={ticket.status} onChange={(e) => updateField({ status: e.target.value as Status })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60">
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="solved">Solved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
                <select disabled={!canEdit} value={ticket.priority} onChange={(e) => updateField({ priority: e.target.value as Priority })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Created</label>
                <div className="text-sm">{new Date(ticket.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
          {(currentRole === "owner" || currentRole === "admin") && (
            <button onClick={onDelete}
              className="w-full rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5">
              Delete ticket
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
