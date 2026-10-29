-- El Drive acepta cualquier archivo: imágenes, vídeos, audio, PDF, EPUB, ZIP…
-- El bucket `library` deja de restringir tipos y sube el límite por archivo
-- (un vídeo ocupa mucho más que un PDF). Sigue siendo privado: solo el admin
-- lee y escribe, y las descargas se sirven con URLs firmadas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('library', 'library', false, 524288000, NULL)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = NULL,
      public = false;

-- Tipos nuevos del Drive: «file» (archivo suelto) además de libro, pack, vídeo,
-- recomendación y carpeta. No hace falta migrar datos: `kind` es texto libre.
COMMENT ON COLUMN public.library_books.kind IS
  'folder | book | pack | video | recommendation | file';
