
-- 1. Lock down settings table: remove public/auth-wide read access; admins only.
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;

-- 2. Create a public_settings view exposing only safe fields.
CREATE OR REPLACE VIEW public.public_settings
WITH (security_invoker = true) AS
SELECT
  id,
  trainer_name,
  trainer_photo_url,
  trainer_bio,
  contact_email,
  yearly_price_eur
FROM public.settings;

-- Make sure RLS on settings does not block the view: re-add a SELECT policy
-- limited to the safe columns is not possible directly, so we instead expose
-- via a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
  trainer_name text,
  trainer_photo_url text,
  trainer_bio text,
  contact_email text,
  yearly_price_eur integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trainer_name, trainer_photo_url, trainer_bio, contact_email, yearly_price_eur
  FROM public.settings
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- Drop the helper view (function is enough and safer)
DROP VIEW IF EXISTS public.public_settings;

-- 3. Tighten profile self-insert: force safe defaults on sensitive billing fields.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(payment_status, 'unpaid') = 'unpaid'
  AND COALESCE(subscription_status, 'inactive') = 'inactive'
  AND COALESCE(subscription_tier, 'none') IN ('none', 'free')
  AND stripe_customer_id IS NULL
  AND stripe_payment_id IS NULL
);

-- 4. Also restrict self-update so users cannot escalate billing/role fields.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND payment_status = (SELECT payment_status FROM public.profiles WHERE user_id = auth.uid())
  AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM public.profiles WHERE user_id = auth.uid())
  AND subscription_tier IS NOT DISTINCT FROM (SELECT subscription_tier FROM public.profiles WHERE user_id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.profiles WHERE user_id = auth.uid())
  AND stripe_payment_id IS NOT DISTINCT FROM (SELECT stripe_payment_id FROM public.profiles WHERE user_id = auth.uid())
  AND subscription_end IS NOT DISTINCT FROM (SELECT subscription_end FROM public.profiles WHERE user_id = auth.uid())
);

-- 5. Fix mutable search_path on existing functions.
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
