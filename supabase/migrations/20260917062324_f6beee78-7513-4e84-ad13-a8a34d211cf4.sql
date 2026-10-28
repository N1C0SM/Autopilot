-- Allow public (anon) read of visible trainer rows through trainer_profiles_public (security_invoker view)
GRANT SELECT (id, display_name, headline, bio, photo_url, specialty, sort_order, visible)
  ON public.trainer_profiles TO anon;

DROP POLICY IF EXISTS "Public can view visible trainer profiles" ON public.trainer_profiles;
CREATE POLICY "Public can view visible trainer profiles"
ON public.trainer_profiles
FOR SELECT
TO anon
USING (visible = true);
