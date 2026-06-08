-- Defense-in-depth: prevent users from modifying the token/user_id columns of calendar_tokens via column-level grants.
-- Token rotation is reserved to service_role; the prevent_calendar_token_change trigger remains as a second layer.
REVOKE UPDATE ON public.calendar_tokens FROM authenticated;
GRANT UPDATE (start_hour_gym, start_hour_activity, duration_min, reminder_min, updated_at) ON public.calendar_tokens TO authenticated;

-- Prevent referrers from reading the referred user's email address.
-- They retain access to status, code, reward_applied, and counts.
REVOKE SELECT ON public.referrals FROM authenticated;
GRANT SELECT (id, referrer_user_id, referral_code, referred_user_id, status, reward_applied, created_at) ON public.referrals TO authenticated;
-- Keep INSERT capability for users creating their own referrals.
GRANT INSERT ON public.referrals TO authenticated;