
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS trainer_name text DEFAULT 'Nicolás',
  ADD COLUMN IF NOT EXISTS trainer_photo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS trainer_bio text DEFAULT '';

CREATE TABLE IF NOT EXISTS public.site_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  result text NOT NULL DEFAULT '',
  text text NOT NULL,
  photo_url text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible testimonials"
  ON public.site_testimonials FOR SELECT
  USING (visible = true);

CREATE POLICY "Admins manage testimonials"
  ON public.site_testimonials FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_site_testimonials_updated_at
  BEFORE UPDATE ON public.site_testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow public read of settings (only landing-visible columns are queried client-side)
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.settings;
CREATE POLICY "Anyone can read public settings"
  ON public.settings FOR SELECT
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Site assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Admins upload site assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update site assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete site assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-assets' AND has_role(auth.uid(), 'admin'::app_role));
