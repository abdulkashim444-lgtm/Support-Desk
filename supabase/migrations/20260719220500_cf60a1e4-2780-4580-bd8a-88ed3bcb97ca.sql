CREATE POLICY "orgs_select_creators"
ON public.organizations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());