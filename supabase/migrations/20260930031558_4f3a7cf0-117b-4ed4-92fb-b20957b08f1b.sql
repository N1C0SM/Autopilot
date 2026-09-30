CREATE TABLE public.trainer_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_profile_id uuid NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuer text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trainer_certificates_profile_idx ON public.trainer_certificates(trainer_profile_id);

GRANT SELECT ON public.trainer_certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_certificates TO authenticated;
GRANT ALL ON public.trainer_certificates TO service_role;

ALTER TABLE public.trainer_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view certificates of visible trainers"
ON public.trainer_certificates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trainer_profiles tp
  WHERE tp.id = trainer_certificates.trainer_profile_id AND tp.visible = true
));

CREATE POLICY "Admins manage certificates"
ON public.trainer_certificates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read certificates of visible trainers"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trainer-certificates'
  AND EXISTS (
    SELECT 1 FROM public.trainer_certificates c
    JOIN public.trainer_profiles tp ON tp.id = c.trainer_profile_id
    WHERE c.file_path = storage.objects.name AND tp.visible = true
  )
);

CREATE POLICY "Admins upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trainer-certificates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trainer-certificates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'trainer-certificates' AND public.has_role(auth.uid(), 'admin'));