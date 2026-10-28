
-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can send messages in own chat" ON public.chat_messages;

-- Recreate with corrected logic
CREATE POLICY "Users can send messages in own chat"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (sender_id = auth.uid())
  AND (
    conversation_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
