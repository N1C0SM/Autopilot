
CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  note text DEFAULT '',
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own photos" ON public.progress_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all photos" ON public.progress_photos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

CREATE POLICY "Users can upload progress photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view progress photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'progress-photos');

CREATE POLICY "Users can delete progress photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
