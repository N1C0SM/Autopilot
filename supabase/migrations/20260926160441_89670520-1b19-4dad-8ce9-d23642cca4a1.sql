-- Subcarpetas ilimitadas en la biblioteca privada
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.library_books(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_folder boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS library_books_parent_idx ON public.library_books(parent_id);

-- Lectura pública sólo de libros publicados (para /recursos)
DROP POLICY IF EXISTS "Public can read published books" ON public.library_books;
CREATE POLICY "Public can read published books"
ON public.library_books
FOR SELECT
TO anon, authenticated
USING (published = true);

GRANT SELECT ON public.library_books TO anon, authenticated;

-- Portadas de la biblioteca legibles para firmar URLs (los PDFs siguen privados)
DROP POLICY IF EXISTS "Public can read library covers" ON storage.objects;
CREATE POLICY "Public can read library covers"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'library' AND name LIKE '%/portada-%');