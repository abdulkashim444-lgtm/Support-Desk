import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "signedOut"; orgName?: string } | { kind: "ready"; orgName: string; role: string }
    | { kind: "error"; msg: string }
  >({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const { data: inv, error } = await supabase
        .from("invitations")
        .select("id, org_id, role, email, expires_at, accepted_at, organizations!inner(name)")
        .eq("token", token)
        .maybeSingle();
      if (error || !inv) return setState({ kind: "error", msg: "Invalid or expired invitation" });
      if (inv.accepted_at) return setState({ kind: "error", msg: "This invitation has already been used" });
      if (new Date(inv.expires_at) < new Date()) return setState({ kind: "error", msg: "This invitation has expired" });
      const orgName = (inv.organizations as unknown as { name: string }).name;
      if (!sess.session) return setState({ kind: "signedOut", orgName });
      setState({ kind: "ready", orgName, role: inv.role });
    })();
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Sign in first");
      const { data: inv, error } = await supabase
        .from("invitations")
        .select("id, org_id, role")
        .eq("token", token)
        .maybeSingle();
      if (error || !inv) throw new Error("Invalid invitation");

      const { error: merr } = await supabase.from("memberships").insert({
        org_id: inv.org_id,
        user_id: sess.session.user.id,
        role: inv.role,
      });
      if (merr && !merr.message.includes("duplicate")) throw merr;

      await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);

      localStorage.setItem("supportdesk.currentOrgId", inv.org_id);
      toast.success("Joined workspace");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Inbox className="h-6 w-6" />
        </div>
        {state.kind === "loading" && <p className="mt-6 text-sm text-muted-foreground">Loading invitation…</p>}
        {state.kind === "error" && (
          <>
            <h1 className="mt-6 font-display text-2xl">Can't join</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.msg}</p>
            <Link to="/" className="mt-6 inline-block rounded-md border border-input px-4 py-2 text-sm hover:bg-secondary">Go home</Link>
          </>
        )}
        {state.kind === "signedOut" && (
          <>
            <h1 className="mt-6 font-display text-2xl">Join {state.orgName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account to accept this invitation.</p>
            <Link to="/auth" search={{ mode: "signup" as const, redirect: `/invite/${token}` }}
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Continue
            </Link>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <h1 className="mt-6 font-display text-2xl">Join {state.orgName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">You'll be added as <b className="capitalize">{state.role}</b>.</p>
            <button onClick={accept} disabled={busy}
              className="mt-6 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busy ? "Joining…" : "Accept invitation"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
