DROP POLICY IF EXISTS "Anyone can read certificates of visible trainers" ON storage.objects;
DROP POLICY IF EXISTS "Read published certificate files" ON storage.objects;

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY CHECK (key ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_secrets TO authenticated;
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage app secrets" ON public.app_secrets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));