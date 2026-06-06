REVOKE SELECT ON public.google_calendar_tokens FROM authenticated;
REVOKE SELECT ON public.google_calendar_tokens FROM anon;

GRANT SELECT (id, user_id, calendar_id, scope, expiry_at, last_sync_at, created_at, updated_at)
  ON public.google_calendar_tokens TO authenticated;

GRANT ALL ON public.google_calendar_tokens TO service_role;