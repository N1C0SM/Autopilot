CREATE TABLE public.trainer_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_profile_id uuid NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  issuer text NOT NULL CHECK (length(trim(issuer)) BETWEEN 1 AND 160),
  file_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainer_certificates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.trainer_certificates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trainer_certificates TO authenticated;
CREATE POLICY "Admins manage certificates" ON public.trainer_certificates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Visible trainer certificates" ON public.trainer_certificates
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.trainer_profiles_public p WHERE p.id = trainer_profile_id)
  );
-- Signed-in visitors see the same public profiles as anonymous visitors.
CREATE POLICY "Signed in visitors see visible trainers" ON public.trainer_profiles
  FOR SELECT TO authenticated USING (visible = true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trainer-certificates', 'trainer-certificates', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Admins manage certificate files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'trainer-certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'trainer-certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Read published certificate files" ON storage.objects
  FOR SELECT TO anon, authenticated USING (
    bucket_id = 'trainer-certificates' AND EXISTS (
      SELECT 1 FROM public.trainer_certificates c
      JOIN public.trainer_profiles_public p ON p.id = c.trainer_profile_id
      WHERE c.file_path = name
    )
  );
