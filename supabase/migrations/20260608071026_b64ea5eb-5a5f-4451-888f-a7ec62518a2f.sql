DROP POLICY IF EXISTS "Users view own gcal connection" ON public.google_calendar_tokens;

CREATE OR REPLACE VIEW public.google_calendar_connections
WITH (security_invoker = true) AS
SELECT id, user_id, calendar_id, scope, expiry_at, last_sync_at, created_at, updated_at
FROM public.google_calendar_tokens
WHERE auth.uid() = user_id;

GRANT SELECT ON public.google_calendar_connections TO authenticated;