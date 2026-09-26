ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS buy_url text;
DROP POLICY IF EXISTS "Public can read library covers" ON storage.objects;