
DROP POLICY IF EXISTS "Users subscribe to own topics" ON realtime.messages;

CREATE POLICY "Users subscribe to own topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Owner: topic ends with the caller's uid, or equals it
  realtime.topic() LIKE '%-' || (auth.uid())::text
  OR realtime.topic() = (auth.uid())::text
  -- Admins keep full access
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  -- Trainers only for users they are assigned to: extract trailing uuid from topic
  OR (
    public.has_role(auth.uid(), 'trainer'::public.app_role)
    AND realtime.topic() ~ '-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_trainer_of(
      auth.uid(),
      (regexp_replace(realtime.topic(), '^.*-([0-9a-fA-F-]{36})$', '\1'))::uuid
    )
  )
);
