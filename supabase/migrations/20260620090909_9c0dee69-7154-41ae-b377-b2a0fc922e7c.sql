
-- ============================================================
-- Security hardening migration
-- 1) Replace overly-permissive leads INSERT policy
-- 2) Restrict public bucket listing (avatars, site-assets)
-- 3) Lock down SECURITY DEFINER function execution
-- ============================================================

-- 1) leads: stop using WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;
CREATE POLICY "Public can submit valid leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND char_length(email) BETWEEN 5 AND 256
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

-- 2) Public buckets: remove broad SELECT policy that enables listing.
-- Direct CDN access via /object/public/<bucket>/<path> still works because
-- it bypasses RLS for buckets marked public.
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Site assets public read" ON storage.objects;

-- Owners can still see their own avatars via API (for listing in dashboards)
CREATE POLICY "Users can read own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Admins can list site-assets via API
CREATE POLICY "Admins can list site assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'site-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3) SECURITY DEFINER function lockdown
-- Trigger-only functions: revoke from everyone (triggers run as table owner)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_calendar_token_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- Email queue plumbing: service_role only
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

-- RLS helpers: must remain callable by authenticated (used inside policies),
-- but anon should not call them directly.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_trainer_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trainer_of(uuid, uuid) TO authenticated, service_role;

-- Public-facing helpers (intentionally exposed to anon for landing page)
REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;

-- User-scoped helpers: authenticated only (they filter by auth.uid() internally)
REVOKE ALL ON FUNCTION public.get_trainer_assigned_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_assigned_profiles() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_trainer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_trainer() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trainer_unassign_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_unassign_user(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_list_trainer_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_trainer_users(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_unassign_user_from_trainer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unassign_user_from_trainer(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trainer_assign_user_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_assign_user_by_email(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_assign_user_to_trainer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_to_trainer(uuid, text) TO authenticated, service_role;
