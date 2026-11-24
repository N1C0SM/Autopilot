DROP POLICY IF EXISTS "Users can create own referrals" ON public.referrals;
REVOKE INSERT ON public.referrals FROM authenticated, anon;