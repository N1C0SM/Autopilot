
-- Drop the broad public SELECT policy that exposed trainer_profiles rows (including user_id) to anon.
DROP POLICY IF EXISTS "Anyone can view visible trainer profiles" ON public.trainer_profiles;

-- Revoke direct table SELECT from anon/authenticated; use the trainer_profiles_public view instead.
REVOKE SELECT ON public.trainer_profiles FROM anon, authenticated;

-- Trainers can still read their own row (needed by admin/trainer dashboards).
DROP POLICY IF EXISTS "Trainers can view own profile row" ON public.trainer_profiles;
CREATE POLICY "Trainers can view own profile row"
  ON public.trainer_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Restore table-level SELECT grant so the above policy can evaluate for authenticated callers.
GRANT SELECT ON public.trainer_profiles TO authenticated;
-- user_id column stays revoked from anon/authenticated (already handled in a prior migration);
-- re-assert to be safe.
REVOKE SELECT (user_id) ON public.trainer_profiles FROM anon, authenticated, PUBLIC;
