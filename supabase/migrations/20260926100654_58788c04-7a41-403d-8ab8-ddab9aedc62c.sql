DROP POLICY IF EXISTS "Authenticated can read training rules" ON public.training_rules;
CREATE POLICY "Admins can read training rules"
ON public.training_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));