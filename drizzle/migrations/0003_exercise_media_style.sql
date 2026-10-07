ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS media_style_version integer,
  ADD COLUMN IF NOT EXISTS image_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_error text;
CREATE INDEX IF NOT EXISTS exercises_media_pending_idx
  ON public.exercises (media_style_version)
  WHERE image_url IS NULL OR video_url IS NULL OR media_style_version IS NULL OR media_error IS NOT NULL;