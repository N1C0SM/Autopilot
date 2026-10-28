
-- Restrict column-level access to trainer_profiles.user_id so the auth UUID
-- is not readable by public/authenticated through the public SELECT policy.
REVOKE SELECT (user_id) ON public.trainer_profiles FROM anon, authenticated, PUBLIC;

-- Service role and admins keep full access via existing GRANT ALL / policies.
GRANT SELECT (id, display_name, headline, bio, photo_url, specialty, sort_order, visible, created_at, updated_at)
  ON public.trainer_profiles TO anon, authenticated;
