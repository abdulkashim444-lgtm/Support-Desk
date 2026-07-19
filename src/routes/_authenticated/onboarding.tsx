import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace";
}

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: userData, error: uerr } = await supabase.auth.getUser();
      if (uerr || !userData.user) throw new Error("Not signed in");
      const user = userData.user;

      const baseSlug = slugify(name);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: org, error: oerr } = await supabase
        .from("organizations")
        .insert({ name, slug, created_by: user.id })
        .select("id")
        .single();
      if (oerr) throw oerr;

      const { error: merr } = await supabase
        .from("memberships")
        .insert({ org_id: org.id, user_id: user.id, role: "owner" });
      if (merr) throw merr;

      localStorage.setItem("supportdesk.currentOrgId", org.id);
      toast.success("Workspace created");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Inbox className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold">SupportDesk</span>
        </div>
        <h1 className="font-display text-3xl">Name your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is where your team will triage tickets together. You can invite teammates in a minute.
        </p>
        <form onSubmit={onCreate} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Workspace name</label>
            <input
              autoFocus required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Acme Support"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button type="submit" disabled={busy || !name}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
