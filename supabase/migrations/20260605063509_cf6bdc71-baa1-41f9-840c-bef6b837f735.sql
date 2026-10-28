
-- 1) google_calendar_tokens: restrict sensitive columns to service_role only
DROP POLICY IF EXISTS "Users manage own gcal tokens" ON public.google_calendar_tokens;

CREATE POLICY "Users view own gcal connection"
  ON public.google_calendar_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.google_calendar_tokens FROM anon, authenticated;
GRANT SELECT (id, user_id, last_sync_at, calendar_id, created_at, updated_at, scope)
  ON public.google_calendar_tokens TO authenticated;
GRANT ALL ON public.google_calendar_tokens TO service_role;

-- 2) referrals: hide referred_email from non-admin users via column-level grant
REVOKE SELECT ON public.referrals FROM authenticated, anon;
GRANT SELECT (id, referrer_user_id, referred_user_id, referral_code, status, reward_applied, created_at)
  ON public.referrals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
