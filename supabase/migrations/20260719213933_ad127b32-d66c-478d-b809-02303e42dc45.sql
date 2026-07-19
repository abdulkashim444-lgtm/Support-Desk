
-- Enums
CREATE TYPE public.org_role AS ENUM ('owner','admin','agent','viewer');
CREATE TYPE public.ticket_status AS ENUM ('open','pending','solved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Memberships (user_roles-equivalent scoped to org)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Security definer helpers to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND org_id = _org_id)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _roles public.org_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND org_id = _org_id AND role = ANY(_roles)
  )
$$;

-- Invitations
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'agent',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  requester_email TEXT,
  requester_name TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_org_status ON public.tickets(org_id, status);
CREATE INDEX idx_tickets_org_created ON public.tickets(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Ticket messages
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is_ticket_org_member
CREATE OR REPLACE FUNCTION public.ticket_org_id(_ticket_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.tickets WHERE id = _ticket_id
$$;

-- Policies: profiles
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_select_shared_org" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  ));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Policies: organizations
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "orgs_insert_any_authenticated" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "orgs_update_admins" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "orgs_delete_owners" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]));

-- Policies: memberships
CREATE POLICY "memberships_select_self" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "memberships_select_same_org" ON public.memberships FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "memberships_insert_admins" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    -- allow the org creator to insert their own initial owner membership,
    -- or an existing owner/admin to add anyone
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.created_by = auth.uid()
    ))
    OR public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
  );
CREATE POLICY "memberships_update_admins" ON public.memberships FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "memberships_delete_admins" ON public.memberships FOR DELETE TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
    OR user_id = auth.uid()
  );

-- Policies: invitations
CREATE POLICY "invitations_select_admins" ON public.invitations FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "invitations_select_by_authenticated_any" ON public.invitations FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "invitations_insert_admins" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
    AND invited_by = auth.uid()
  );
CREATE POLICY "invitations_update_admins" ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "invitations_delete_admins" ON public.invitations FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- Policies: tickets
CREATE POLICY "tickets_select_members" ON public.tickets FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tickets_insert_agents" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','agent']::public.org_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "tickets_update_agents" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','agent']::public.org_role[]));
CREATE POLICY "tickets_delete_admins" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- Policies: ticket_messages
CREATE POLICY "tm_select_members_nonviewer_or_public" ON public.ticket_messages FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), public.ticket_org_id(ticket_id))
    AND (
      is_internal = false
      OR public.has_org_role(auth.uid(), public.ticket_org_id(ticket_id), ARRAY['owner','admin','agent']::public.org_role[])
    )
  );
CREATE POLICY "tm_insert_agents" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.has_org_role(auth.uid(), public.ticket_org_id(ticket_id), ARRAY['owner','admin','agent']::public.org_role[])
  );
CREATE POLICY "tm_update_author" ON public.ticket_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "tm_delete_admins_or_author" ON public.ticket_messages FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_org_role(auth.uid(), public.ticket_org_id(ticket_id), ARRAY['owner','admin']::public.org_role[])
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
