import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrgProvider, useOrg, canManage } from "@/lib/org-context";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2, Copy, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

type OrgRole = Database["public"]["Enums"]["org_role"];

export const Route = createFileRoute("/_authenticated/members")({
  component: () => (
    <OrgProvider>
      <MembersGate />
    </OrgProvider>
  ),
});

function MembersGate() {
  const { memberships, isLoading, currentOrg } = useOrg();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && memberships.length === 0) navigate({ to: "/onboarding" });
  }, [isLoading, memberships.length, navigate]);

  if (isLoading || !currentOrg) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  return <AppShell><MembersPage /></AppShell>;
}

function MembersPage() {
  const { currentOrg, currentRole } = useOrg();
  const qc = useQueryClient();
  const isAdmin = canManage(currentRole);

  const { data: members } = useQuery({
    queryKey: ["members", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, role, user_id, created_at, profiles!inner(full_name, email, avatar_url)")
        .eq("org_id", currentOrg!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["invitations", currentOrg?.id],
    enabled: !!currentOrg && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, token, created_at, expires_at, accepted_at")
        .eq("org_id", currentOrg!.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("agent");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("invitations").insert({
        org_id: currentOrg.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: userData.user!.id,
      });
      if (error) throw error;
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation created — copy the link to share");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedToken(null), 1500);
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invitations"] });
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members"] });
    toast.success("Member removed");
  }

  async function changeRole(id: string, role: OrgRole) {
    const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members"] });
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
        <h1 className="mt-1 font-display text-4xl">Team</h1>
      </header>

      {isAdmin && (
        <div className="mb-8 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite a teammate</h2>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs font-medium">Email</label>
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Role</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              Create invite
            </button>
          </form>
          {invites && invites.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-md border border-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{inv.email}</div>
                    <div className="text-xs text-muted-foreground capitalize">{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(inv.token)}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-secondary">
                      {copiedToken === inv.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy link
                    </button>
                    <button onClick={() => revokeInvite(inv.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/5">
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">Members</div>
        <ul className="divide-y divide-border">
          {members?.map((m) => {
            const p = m.profiles as unknown as { full_name?: string; email?: string; avatar_url?: string };
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-medium">
                    {(p.full_name ?? p.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{p.full_name ?? p.email}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && m.role !== "owner" ? (
                    <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value as OrgRole)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize">{m.role}</span>
                  )}
                  {isAdmin && m.role !== "owner" && (
                    <button onClick={() => removeMember(m.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/5 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
