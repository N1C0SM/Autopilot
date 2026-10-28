ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS free_campaign boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.get_free_campaign() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT COALESCE((SELECT free_campaign FROM public.settings LIMIT 1), false) $$;
REVOKE ALL ON FUNCTION public.get_free_campaign() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_free_campaign() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_consumer_plans_public()
RETURNS TABLE(key text, name text, tagline text, description text, price numeric, currency text, billing_interval text, trial_days integer, features jsonb, not_included jsonb, cta text, accepting_new_subscriptions boolean, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT key, name, tagline, description, price, currency, billing_interval, trial_days, features, not_included, cta, accepting_new_subscriptions, sort_order FROM public.product_configs
WHERE key IN ('free','training','full') AND enabled AND publicly_visible AND (NOT public.get_free_campaign() OR key='free') ORDER BY sort_order;
$$;
CREATE OR REPLACE FUNCTION public.has_active_nutrition_access(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id
AND (_user_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_trainer_of(auth.uid(),_user_id))
AND (public.get_free_campaign() OR (p.payment_status='paid' AND p.subscription_tier IN ('training','plus','full','transform','personal','coach')
AND (NULLIF(p.stripe_payment_id,'') IS NOT NULL OR (p.subscription_status IN ('active','trialing') AND (p.subscription_end IS NULL OR p.subscription_end>now()))))));
$$;