
-- Fix invitations insert: admins cannot invite owners
DROP POLICY IF EXISTS invitations_insert_admins ON public.invitations;
CREATE POLICY invitations_insert_admins ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[])
    AND (
      role <> 'owner'::org_role
      OR public.has_org_role(auth.uid(), org_id, ARRAY['owner']::org_role[])
    )
  );

-- Fix memberships update: only owners can assign/remove owner role
DROP POLICY IF EXISTS memberships_update_admins ON public.memberships;
CREATE POLICY memberships_update_admins ON public.memberships
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[])
    AND (
      role <> 'owner'::org_role
      OR public.has_org_role(auth.uid(), org_id, ARRAY['owner']::org_role[])
    )
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[])
    AND (
      role <> 'owner'::org_role
      OR public.has_org_role(auth.uid(), org_id, ARRAY['owner']::org_role[])
    )
  );
