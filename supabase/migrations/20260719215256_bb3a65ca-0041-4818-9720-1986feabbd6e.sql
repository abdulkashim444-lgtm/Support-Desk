
-- 1. Fix invitations: remove overly-permissive SELECT policy, add invitee-scoped policy
DROP POLICY IF EXISTS invitations_select_by_authenticated_any ON public.invitations;

CREATE POLICY invitations_select_own_email
ON public.invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 2. Fix SECURITY DEFINER helpers: switch to SECURITY INVOKER so they cannot be
-- used to probe other users' data via PostgREST RPC. Callers already have RLS
-- read access to their own memberships and to tickets in their orgs, so these
-- helpers keep working inside RLS policies.
ALTER FUNCTION public.is_org_member(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) SECURITY INVOKER;
ALTER FUNCTION public.ticket_org_id(uuid) SECURITY INVOKER;

-- Prevent RPC exposure of these helpers via PostgREST
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ticket_org_id(uuid) FROM anon, authenticated, PUBLIC;

-- Grant back only where actually needed for RLS evaluation. Postgres evaluates
-- functions in RLS USING/WITH CHECK clauses with the invoker's privileges, so
-- authenticated needs EXECUTE — but anon does not.
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_org_id(uuid) TO authenticated;
