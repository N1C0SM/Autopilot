
-- 1) Rate limits table (used by edge functions via service role)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_key_created_idx ON public.rate_limits (key, created_at DESC);

GRANT ALL ON public.rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limits_id_seq TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: only service_role can touch this table.

-- 2) Tighten referrals INSERT policy: force pending + reward_applied=false
DROP POLICY IF EXISTS "Users can create own referrals" ON public.referrals;
CREATE POLICY "Users can create own referrals"
  ON public.referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = referrer_user_id
    AND COALESCE(status, 'pending') = 'pending'
    AND COALESCE(reward_applied, false) = false
  );

-- Also prevent regular users from UPDATE-ing status / reward_applied via a trigger,
-- so the fix holds even if an UPDATE policy is added later.
CREATE OR REPLACE FUNCTION public.referrals_guard_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.reward_applied IS DISTINCT FROM OLD.reward_applied THEN
    NEW.reward_applied := OLD.reward_applied;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referrals_guard_state_change_trg ON public.referrals;
CREATE TRIGGER referrals_guard_state_change_trg
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.referrals_guard_state_change();
