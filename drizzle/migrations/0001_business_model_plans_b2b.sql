-- Trainer <-> client relationship type/status
ALTER TABLE public.trainer_assignments
  ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'AUTOPILOT_COACH',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.trainer_assignments
  ADD CONSTRAINT trainer_assignments_relationship_type_chk CHECK (relationship_type IN ('AUTOPILOT_COACH','TRAINER_OWN_CLIENT')),
  ADD CONSTRAINT trainer_assignments_status_chk CHECK (status IN ('active','paused','ended'));

-- Entitlements: what the user has, independent of where it was bought
CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('plus','coach','trainer')),
  source text NOT NULL CHECK (source IN ('stripe','apple','google','admin','promo','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  external_id text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan, source)
);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own entitlements" ON public.entitlements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage entitlements" ON public.entitlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
GRANT INSERT, UPDATE, DELETE ON public.entitlements TO authenticated;
CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON public.entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from existing paid profiles
INSERT INTO public.entitlements (user_id, plan, source, status, expires_at)
SELECT user_id,
  CASE WHEN subscription_tier = 'training' THEN 'plus' ELSE 'coach' END,
  CASE WHEN stripe_customer_id IS NOT NULL OR stripe_payment_id IS NOT NULL THEN 'stripe' ELSE 'admin' END,
  CASE WHEN subscription_status = 'trialing' THEN 'trialing' ELSE 'active' END,
  subscription_end
FROM public.profiles
WHERE payment_status = 'paid' AND subscription_tier IN ('training','full','transform','personal')
ON CONFLICT DO NOTHING;

-- Product configuration (B2B trainer plan), disabled by default
CREATE TABLE public.product_configs (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
  max_clients integer NOT NULL DEFAULT 10,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  publicly_visible boolean NOT NULL DEFAULT false,
  accepting_new_subscriptions boolean NOT NULL DEFAULT false,
  stripe_price_id_test text,
  stripe_price_id_live text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.product_configs TO authenticated;
GRANT ALL ON public.product_configs TO service_role;
ALTER TABLE public.product_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage product configs" ON public.product_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER update_product_configs_updated_at BEFORE UPDATE ON public.product_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.product_configs (key, name, description, price, max_clients, features)
VALUES ('trainer_plan','Autopilot para entrenadores','Gestiona a tus clientes con Autopilot.',0,10,
  '["Panel de clientes","Planes de entrenamiento","Check-ins","Mensajes","Herramientas de IA"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Public, safe read of the trainer plan (only when enabled & visible)
CREATE OR REPLACE FUNCTION public.get_trainer_plan_public()
RETURNS TABLE(name text, description text, price numeric, currency text, billing_interval text, max_clients integer, features jsonb, accepting_new_subscriptions boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name, description, price, currency, billing_interval, max_clients, features, accepting_new_subscriptions
  FROM public.product_configs WHERE key = 'trainer_plan' AND enabled AND publicly_visible;
$$;

CREATE OR REPLACE FUNCTION public.trainer_plan_open()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled AND accepting_new_subscriptions FROM public.product_configs WHERE key='trainer_plan'), false);
$$;

CREATE OR REPLACE FUNCTION public.trainer_plan_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.product_configs WHERE key='trainer_plan'), false);
$$;

-- Trainer invitations (B2B own clients)
CREATE TABLE public.trainer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trainer_invitations TO authenticated;
GRANT ALL ON public.trainer_invitations TO service_role;
ALTER TABLE public.trainer_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers view own invitations" ON public.trainer_invitations FOR SELECT TO authenticated USING (auth.uid() = trainer_id);
CREATE POLICY "Trainers create invitations when B2B enabled" ON public.trainer_invitations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = trainer_id AND public.has_role(auth.uid(),'trainer'::app_role) AND public.trainer_plan_enabled()
    AND EXISTS (SELECT 1 FROM public.entitlements e WHERE e.user_id = auth.uid() AND e.plan='trainer' AND e.status IN ('active','trialing')));
CREATE POLICY "Trainers revoke own invitations" ON public.trainer_invitations FOR UPDATE TO authenticated
  USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id AND status IN ('pending','revoked'));
CREATE POLICY "Admins manage invitations" ON public.trainer_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Accept invitation (client side), enforcing flag + client limit
CREATE OR REPLACE FUNCTION public.accept_trainer_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.trainer_invitations; _caller uuid := auth.uid(); _email text; _max int; _count int;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.trainer_plan_enabled() THEN RAISE EXCEPTION 'b2b_disabled'; END IF;
  SELECT * INTO _inv FROM public.trainer_invitations WHERE token = _token FOR UPDATE;
  IF _inv.id IS NULL OR _inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_invalid'; END IF;
  IF _inv.expires_at < now() THEN UPDATE public.trainer_invitations SET status='expired' WHERE id=_inv.id; RAISE EXCEPTION 'invitation_expired'; END IF;
  SELECT email INTO _email FROM public.profiles WHERE user_id = _caller;
  IF lower(_email) <> lower(_inv.email) THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;
  SELECT max_clients INTO _max FROM public.product_configs WHERE key='trainer_plan';
  SELECT count(*) INTO _count FROM public.trainer_assignments WHERE trainer_id=_inv.trainer_id AND relationship_type='TRAINER_OWN_CLIENT' AND status='active';
  IF _count >= COALESCE(_max, 0) THEN RAISE EXCEPTION 'client_limit_reached'; END IF;
  DELETE FROM public.trainer_assignments WHERE user_id = _caller;
  INSERT INTO public.trainer_assignments (trainer_id, user_id, relationship_type) VALUES (_inv.trainer_id, _caller, 'TRAINER_OWN_CLIENT');
  UPDATE public.trainer_invitations SET status='accepted' WHERE id=_inv.id;
  RETURN _inv.trainer_id;
END; $$;

-- Trainers can no longer assign arbitrary users; only admins (Coach) or invitations (B2B)
CREATE OR REPLACE FUNCTION public.trainer_assign_user_by_email(_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _caller uuid := auth.uid(); _user_id uuid;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_caller, 'admin'::app_role) THEN RAISE EXCEPTION 'only admins can assign users'; END IF;
  SELECT user_id INTO _user_id FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  DELETE FROM public.trainer_assignments WHERE user_id = _user_id;
  INSERT INTO public.trainer_assignments (trainer_id, user_id, relationship_type) VALUES (_caller, _user_id, 'AUTOPILOT_COACH');
  RETURN _user_id;
END; $$;

-- Coach plan status for the current user
CREATE OR REPLACE FUNCTION public.get_my_consumer_plan()
RETURNS TABLE(plan text, coach_assigned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE WHEN bool_or(e.plan='coach') THEN 'coach' WHEN bool_or(e.plan='plus') THEN 'plus' END
    FROM public.entitlements e
    WHERE e.user_id = auth.uid() AND e.plan IN ('plus','coach') AND e.status IN ('active','trialing')
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ), 'free'),
  EXISTS (SELECT 1 FROM public.trainer_assignments ta WHERE ta.user_id = auth.uid() AND ta.status='active');
$$;