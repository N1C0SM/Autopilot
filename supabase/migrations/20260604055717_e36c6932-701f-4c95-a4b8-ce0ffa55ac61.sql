DROP POLICY IF EXISTS "Trainers update assigned users profile" ON public.profiles;

CREATE POLICY "Trainers update assigned users profile"
ON public.profiles
FOR UPDATE
USING (public.is_trainer_of(auth.uid(), user_id))
WITH CHECK (
  public.is_trainer_of(auth.uid(), user_id)
  AND payment_status IS NOT DISTINCT FROM (SELECT p.payment_status FROM public.profiles p WHERE p.user_id = profiles.user_id)
  AND subscription_status IS NOT DISTINCT FROM (SELECT p.subscription_status FROM public.profiles p WHERE p.user_id = profiles.user_id)
  AND subscription_tier IS NOT DISTINCT FROM (SELECT p.subscription_tier FROM public.profiles p WHERE p.user_id = profiles.user_id)
  AND subscription_end IS NOT DISTINCT FROM (SELECT p.subscription_end FROM public.profiles p WHERE p.user_id = profiles.user_id)
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM public.profiles p WHERE p.user_id = profiles.user_id)
  AND stripe_payment_id IS NOT DISTINCT FROM (SELECT p.stripe_payment_id FROM public.profiles p WHERE p.user_id = profiles.user_id)
);