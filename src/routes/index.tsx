import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, Users, ShieldCheck, Zap, Building2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Inbox className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">SupportDesk</span>
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#tenants" className="hover:text-foreground">Multi-tenant</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" as const }} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container-page py-24 md:py-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Now with metered usage billing
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
            The helpdesk your{" "}
            <span className="italic text-muted-foreground">whole team</span> can actually run.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            SupportDesk gives every workspace its own private tickets, SLAs, and audit trail — with tenant isolation baked in at the database.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/auth" search={{ mode: "signup" as const }} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start free workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 rounded-md border border-input px-5 py-3 text-sm font-medium hover:bg-secondary">
              See how it works
            </a>
          </div>
        </div>

        {/* Ticket preview */}
        <div className="relative mt-20 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning" />
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="ml-3 text-xs text-muted-foreground">acme.supportdesk.app / tickets</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
            <aside className="border-r border-border bg-sidebar p-4 text-sm">
              <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Views</div>
              <ul className="space-y-1">
                {["All open", "Unassigned", "Assigned to me", "Recently solved"].map((v, i) => (
                  <li key={v} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-secondary" : "text-muted-foreground"}`}>{v}</li>
                ))}
              </ul>
            </aside>
            <div className="divide-y divide-border">
              {[
                { s: "urgent", t: "Cannot export monthly report", who: "Priya @ Northwind", ago: "2m" },
                { s: "high", t: "SSO redirect loops for @globex.co users", who: "Mateo @ Globex", ago: "17m" },
                { s: "normal", t: "Rate limit on public API key", who: "Jordan @ Initech", ago: "1h" },
                { s: "low", t: "Add dark mode to embed widget", who: "Sam @ Umbrella", ago: "3h" },
              ].map((r) => (
                <div key={r.t} className="grid grid-cols-[80px_1fr_auto] items-center gap-4 px-5 py-3 text-sm hover:bg-secondary/50">
                  <span className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                    r.s === "urgent" ? "bg-destructive/10 text-destructive" :
                    r.s === "high" ? "bg-warning/20 text-warning-foreground" :
                    r.s === "normal" ? "bg-secondary text-secondary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>{r.s}</span>
                  <div className="truncate">
                    <div className="font-medium">{r.t}</div>
                    <div className="text-xs text-muted-foreground">{r.who}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.ago}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-secondary/40 py-24">
        <div className="container-page">
          <h2 className="max-w-2xl font-display text-4xl md:text-5xl">
            Built for teams that treat support as a product.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Building2, t: "True multi-tenant", d: "Every workspace is isolated at the row level. No cross-tenant leaks, ever." },
              { icon: Users, t: "Roles that make sense", d: "Owner, Admin, Agent, Viewer — with fine-grained access to internal notes." },
              { icon: ShieldCheck, t: "Audit-ready", d: "Every action is timestamped and attributed. Ready for enterprise procurement." },
              { icon: Zap, t: "Fast by default", d: "Optimistic UI, keyboard shortcuts, and instant search. No loading spinners." },
              { icon: Inbox, t: "One inbox, many channels", d: "Email, web widget, and public API. All in one triage view." },
              { icon: ArrowRight, t: "Metered billing", d: "Bill per seat or per resolved ticket. Stripe-native, no glue code." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="border-t border-border py-24">
        <div className="container-page text-center">
          <h2 className="font-display text-4xl md:text-5xl">Start your workspace in 30 seconds.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Free forever for the first 3 seats. No credit card required.</p>
          <Link to="/auth" search={{ mode: "signup" as const }} className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Create your workspace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container-page flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} SupportDesk</span>
          <span>Built By Abdul Kasim</span>
        </div>
      </footer>
    </div>
  );
}
