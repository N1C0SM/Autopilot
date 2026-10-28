ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'book',
  ADD COLUMN IF NOT EXISTS video_url text;

UPDATE public.library_books
SET kind = CASE WHEN is_folder THEN 'folder' WHEN is_pack THEN 'pack' ELSE 'book' END;