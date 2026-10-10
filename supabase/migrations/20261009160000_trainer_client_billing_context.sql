-- Return the minimum billing context needed for the shared client capability
-- resolver. The original RPC omitted tier/status, making Coach chat disappear.
-- Access remains limited to clients assigned to auth.uid(); no RLS policy changes.
BEGIN;

DROP FUNCTION public.get_trainer_assigned_profiles();
CREATE FUNCTION public.get_trainer_assigned_profiles()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  plan_status text,
  payment_status text,
  referral_code text,
  referred_by text,
  travel_mode_until date,
  travel_equipment text,
  created_at timestamptz,
  updated_at timestamptz,
  subscription_tier text,
  subscription_status text,
  subscription_end timestamptz,
  stripe_payment_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.email, p.name, p.avatar_url, p.plan_status, p.payment_status,
         p.referral_code, p.referred_by, p.travel_mode_until, p.travel_equipment,
         p.created_at, p.updated_at, p.subscription_tier, p.subscription_status,
         p.subscription_end, CASE WHEN NULLIF(p.stripe_payment_id, '') IS NOT NULL THEN 'legacy_purchase' ELSE NULL END
  FROM public.profiles p
  JOIN public.trainer_assignments ta ON ta.user_id = p.user_id
  WHERE ta.trainer_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_trainer_assigned_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_assigned_profiles() TO authenticated, service_role;

COMMIT;
