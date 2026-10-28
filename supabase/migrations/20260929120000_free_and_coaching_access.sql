-- Free accounts are never purchases. Checkout and user metadata cannot grant coaching.
BEGIN;
ALTER TABLE public.profiles ALTER COLUMN subscription_tier SET DEFAULT 'free';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, referred_by, payment_status, subscription_tier, subscription_status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'referral_code', ''), ''), 'unpaid', 'free', 'inactive');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Repair only identifiable old free signups without a Stripe purchase/customer.
-- Do not bulk-revoke legacy/manual paid accounts or delete their training history.
UPDATE public.profiles p SET payment_status = 'unpaid', subscription_tier = 'free', subscription_status = 'inactive', subscription_end = NULL
FROM auth.users u WHERE p.user_id = u.id AND u.raw_user_meta_data->>'is_free' = 'true'
  AND p.stripe_customer_id IS NULL AND p.stripe_payment_id IS NULL;

CREATE OR REPLACE FUNCTION public.has_coaching_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id
    AND p.payment_status = 'paid' AND p.subscription_tier IN ('training', 'full', 'transform', 'personal')
    AND (p.stripe_payment_id IS NOT NULL OR (p.subscription_status IN ('active', 'trialing')
      AND (p.subscription_end IS NULL OR p.subscription_end > now()))));
$$;
REVOKE ALL ON FUNCTION public.has_coaching_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_coaching_access(uuid) TO authenticated, service_role;

-- Enforce immutable billing fields for both owners and trainers, without recursive RLS.
CREATE OR REPLACE FUNCTION public.protect_billing_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
    AND ROW(NEW.payment_status, NEW.subscription_status, NEW.subscription_tier, NEW.subscription_end, NEW.stripe_customer_id, NEW.stripe_payment_id)
      IS DISTINCT FROM ROW(OLD.payment_status, OLD.subscription_status, OLD.subscription_tier, OLD.subscription_end, OLD.stripe_customer_id, OLD.stripe_payment_id)
  THEN RAISE EXCEPTION 'Billing fields can only be changed by the payment service'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_billing_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_billing_fields BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_fields();
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Trainers update assigned users profile" ON public.profiles;
CREATE POLICY "Trainers update assigned users profile" ON public.profiles FOR UPDATE TO authenticated
USING (public.is_trainer_of(auth.uid(), user_id)) WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- Restrictive policies compose with existing owner/admin/trainer policies.
CREATE POLICY "Coaching required to send chat" ON public.chat_messages AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'trainer'::public.app_role)
  OR (sender_id = auth.uid() AND conversation_user_id = auth.uid() AND public.has_coaching_access(auth.uid()))
);
CREATE POLICY "Nutrition requires full coaching" ON public.nutrition_plan AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_trainer_of(auth.uid(), user_id)
  OR (auth.uid() = user_id AND public.has_coaching_access(user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.subscription_tier <> 'training'))
);
-- Paid nutrition is prepared by staff, not self-granted through direct table writes.
CREATE POLICY "Staff prepares nutrition" ON public.nutrition_plan AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_trainer_of(auth.uid(), user_id));
CREATE POLICY "Staff adjusts nutrition" ON public.nutrition_plan AS RESTRICTIVE
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_trainer_of(auth.uid(), user_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_trainer_of(auth.uid(), user_id));
COMMIT;
