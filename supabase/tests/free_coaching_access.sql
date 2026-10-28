-- Executed against a disposable Postgres-compatible fixture, never production.
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-000000000001','free@example.invalid','{"is_free":"true","selected_plan":"full"}');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id='00000000-0000-0000-0000-000000000001' AND payment_status='unpaid' AND subscription_tier='free') THEN RAISE EXCEPTION 'signup granted paid access'; END IF;
END $$;
INSERT INTO public.nutrition_plan(user_id) VALUES ('00000000-0000-0000-0000-000000000001');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
 IF public.has_coaching_access(auth.uid()) THEN RAISE EXCEPTION 'free coaching'; END IF;
 IF EXISTS (SELECT 1 FROM public.nutrition_plan) THEN RAISE EXCEPTION 'free nutrition leak'; END IF;
 BEGIN
   UPDATE public.profiles SET payment_status='paid',subscription_tier='full',subscription_status='active' WHERE user_id=auth.uid();
   RAISE EXCEPTION 'billing escalation succeeded';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Billing fields can only be changed by the payment service' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO public.chat_messages(sender_id,conversation_user_id) VALUES(auth.uid(),auth.uid());
   RAISE EXCEPTION 'free chat succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 UPDATE public.profiles SET name='Allowed profile edit' WHERE user_id=auth.uid();
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
UPDATE public.profiles SET payment_status='paid',subscription_tier='training',subscription_status='trialing',subscription_end=now()+interval '7 days';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
 IF NOT public.has_coaching_access(auth.uid()) THEN RAISE EXCEPTION 'trial should allow coaching'; END IF;
 IF EXISTS (SELECT 1 FROM public.nutrition_plan) THEN RAISE EXCEPTION 'training nutrition leak'; END IF;
 INSERT INTO public.chat_messages(sender_id,conversation_user_id) VALUES(auth.uid(),auth.uid());
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
UPDATE public.profiles SET subscription_tier='full';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.nutrition_plan) THEN RAISE EXCEPTION 'full nutrition denied'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',false);
UPDATE public.profiles SET subscription_end=now()-interval '1 day';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
 IF public.has_coaching_access(auth.uid()) THEN RAISE EXCEPTION 'expired coaching allowed'; END IF;
 IF EXISTS (SELECT 1 FROM public.nutrition_plan) THEN RAISE EXCEPTION 'expired nutrition allowed'; END IF;
END $$;
RESET ROLE;
