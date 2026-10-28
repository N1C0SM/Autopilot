
-- Tighten realtime topic matching to exact known prefixes instead of LIKE suffix matching
DROP POLICY IF EXISTS "Users subscribe to own topics" ON realtime.messages;

CREATE POLICY "Users subscribe to own topics" ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('notifications-' || (auth.uid())::text)
  OR realtime.topic() = ('chat-' || (auth.uid())::text)
  OR realtime.topic() = ('dashboard-' || (auth.uid())::text)
  OR realtime.topic() = ('calendar-' || (auth.uid())::text)
  OR realtime.topic() = (auth.uid())::text
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'trainer'::public.app_role)
    AND realtime.topic() ~ '^chat-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_trainer_of(auth.uid(), (substring(realtime.topic() from 6))::uuid)
  )
);

-- Defense-in-depth: restrictive UPDATE policy on referrals so only admins/service_role
-- can ever run UPDATE, even if a future permissive policy is added by mistake.
DROP POLICY IF EXISTS "Restrict referral updates to admins" ON public.referrals;
CREATE POLICY "Restrict referral updates to admins"
ON public.referrals
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
