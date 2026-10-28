DROP POLICY IF EXISTS "Trainers create notifications for assigned users" ON public.notifications;

CREATE POLICY "Trainers create notifications for assigned users"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_trainer_of(auth.uid(), user_id)
  AND type = 'trainer_message'
  AND length(coalesce(title, '')) BETWEEN 1 AND 120
  AND length(coalesce(message, '')) BETWEEN 1 AND 1000
);