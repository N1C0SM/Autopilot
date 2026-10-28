-- Match the shared consumer capabilities without changing B2B entitlements or
-- granting table access. Restrictive policies also work when the older paid
-- access migration has not been applied to the project.
BEGIN;

CREATE OR REPLACE FUNCTION public.has_active_nutrition_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id
      AND (_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.is_trainer_of(auth.uid(), _user_id))
      AND p.payment_status = 'paid'
      AND p.subscription_tier IN ('training', 'plus', 'full', 'transform', 'personal', 'coach')
      AND (NULLIF(p.stripe_payment_id, '') IS NOT NULL
        OR (p.subscription_status IN ('active', 'trialing')
          AND (p.subscription_end IS NULL OR p.subscription_end > now())))
  );
$$;

CREATE OR REPLACE FUNCTION public.has_human_coach_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_active_nutrition_access(_user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id
        AND p.subscription_tier IN ('full', 'transform', 'personal', 'coach'));
$$;

REVOKE ALL ON FUNCTION public.has_active_nutrition_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_human_coach_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_nutrition_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_human_coach_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Nutrition requires full coaching" ON public.nutrition_plan;
DROP POLICY IF EXISTS "Nutrition requires active paid plan" ON public.nutrition_plan;
CREATE POLICY "Nutrition requires active paid plan" ON public.nutrition_plan AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_trainer_of(auth.uid(), user_id)
  OR (auth.uid() = user_id AND public.has_active_nutrition_access(user_id))
);

DROP POLICY IF EXISTS "Coaching required to send chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Coach capability required to read chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Coach capability required to send chat" ON public.chat_messages;

-- The trainer's own conversation is the internal trainer/admin channel.
-- Existing permissive policies still determine who can reach each channel.
CREATE POLICY "Coach capability required to read chat" ON public.chat_messages AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (conversation_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::public.app_role))
  OR ((conversation_user_id = auth.uid() OR public.is_trainer_of(auth.uid(), conversation_user_id))
    AND public.has_human_coach_access(conversation_user_id))
);

CREATE POLICY "Coach capability required to send chat" ON public.chat_messages AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (conversation_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::public.app_role))
    OR ((conversation_user_id = auth.uid() OR public.is_trainer_of(auth.uid(), conversation_user_id))
      AND public.has_human_coach_access(conversation_user_id))
  )
);

COMMIT;
