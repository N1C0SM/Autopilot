
-- 1) REALTIME
DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users subscribe to own topics" ON realtime.messages;
CREATE POLICY "Users subscribe to own topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE '%-' || (auth.uid())::text
  OR realtime.topic() = (auth.uid())::text
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'trainer'::public.app_role)
);

-- 2) STORAGE progress-photos
DROP POLICY IF EXISTS "Users can view progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: owner select" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: admin select" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: trainer select assigned" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: admin/trainer insert for assigned" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos: admin delete" ON storage.objects;

CREATE POLICY "Progress photos: owner select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='progress-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Progress photos: admin select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='progress-photos' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Progress photos: trainer select assigned" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='progress-photos' AND public.is_trainer_of(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Progress photos: owner insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='progress-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Progress photos: admin/trainer insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='progress-photos' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_trainer_of(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Progress photos: owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='progress-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "Progress photos: admin delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='progress-photos' AND public.has_role(auth.uid(),'admin'::public.app_role));

-- 3) SECURITY DEFINER revokes
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_calendar_token_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unassign_user_from_trainer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_trainer_users(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_assign_user_to_trainer(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trainer_assign_user_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trainer_unassign_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_trainer_assigned_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_trainer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_trainer_of(uuid, uuid) FROM PUBLIC, anon;

-- 4) nutrition_plan + training_plan: owner insert/update
DROP POLICY IF EXISTS "Users can insert own nutrition plan" ON public.nutrition_plan;
DROP POLICY IF EXISTS "Users can update own nutrition plan" ON public.nutrition_plan;
CREATE POLICY "Users can insert own nutrition plan" ON public.nutrition_plan
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition plan" ON public.nutrition_plan
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own training plan" ON public.training_plan;
DROP POLICY IF EXISTS "Users can update own training plan" ON public.training_plan;
CREATE POLICY "Users can insert own training plan" ON public.training_plan
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own training plan" ON public.training_plan
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Leads: explicit anon INSERT + admin update
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;
CREATE POLICY "Anyone can submit leads" ON public.leads
FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins update leads" ON public.leads;
CREATE POLICY "Admins update leads" ON public.leads
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- 6) trainer_profiles_public view (omits user_id)
DROP VIEW IF EXISTS public.trainer_profiles_public;
CREATE VIEW public.trainer_profiles_public
WITH (security_invoker=on) AS
SELECT id, display_name, headline, bio, photo_url, specialty, sort_order, visible
FROM public.trainer_profiles
WHERE visible = true;
GRANT SELECT ON public.trainer_profiles_public TO anon, authenticated;
