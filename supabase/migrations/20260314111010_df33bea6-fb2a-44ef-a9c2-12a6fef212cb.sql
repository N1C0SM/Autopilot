
-- Add image_url to exercises for GIF/image support
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url text;

-- Add rest_seconds to have a cleaner numeric rest field
-- (keeping existing data compatible)
