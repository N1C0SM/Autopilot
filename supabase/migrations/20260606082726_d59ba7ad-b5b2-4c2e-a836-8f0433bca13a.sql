-- 1) Lock down referrals.referred_email so referrers can't read it via SELECT *.
REVOKE SELECT (referred_email) ON public.referrals FROM authenticated;
REVOKE SELECT (referred_email) ON public.referrals FROM anon;

-- 2) Remove Stripe webhook secrets from the database. They live only in edge function secrets.
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS webhook_secret_test,
  DROP COLUMN IF EXISTS webhook_secret_live;