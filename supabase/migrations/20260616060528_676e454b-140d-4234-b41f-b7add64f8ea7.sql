DROP POLICY IF EXISTS "Trainers view assigned users profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_trainer_assigned_profiles()
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
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.email, p.name, p.avatar_url, p.plan_status, p.payment_status,
         p.referral_code, p.referred_by, p.travel_mode_until, p.travel_equipment,
         p.created_at, p.updated_at
  FROM public.profiles p
  JOIN public.trainer_assignments ta ON ta.user_id = p.user_id
  WHERE ta.trainer_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_trainer_assigned_profiles() TO authenticated;