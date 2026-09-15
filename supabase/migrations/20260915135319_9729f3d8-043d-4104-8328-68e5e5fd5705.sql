CREATE POLICY "Call signaling read" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() = ('call-' || (auth.uid())::text)
  OR (
    realtime.topic() ~ '^call-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_trainer_of(auth.uid(), (substring(realtime.topic() from 6))::uuid)
    )
  )
);

CREATE POLICY "Call signaling write" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() = ('call-' || (auth.uid())::text)
  OR (
    realtime.topic() ~ '^call-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_trainer_of(auth.uid(), (substring(realtime.topic() from 6))::uuid)
    )
  )
);