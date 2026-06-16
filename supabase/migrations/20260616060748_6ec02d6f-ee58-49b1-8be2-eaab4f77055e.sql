ALTER TABLE public.site_testimonials
  ADD COLUMN IF NOT EXISTS photo_before_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_after_url text DEFAULT '';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lifecycle_emails_sent text[] NOT NULL DEFAULT '{}';