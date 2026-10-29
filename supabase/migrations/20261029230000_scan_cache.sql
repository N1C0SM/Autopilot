-- Scan coherente: la misma foto (con los mismos datos) da siempre el mismo resultado.
-- analyze-physique guarda aquí el primer análisis por huella SHA-256 de lo enviado y lo
-- reutiliza. Sin políticas: solo la función (service role) lee y escribe.
CREATE TABLE IF NOT EXISTS public.scan_cache (
  key text PRIMARY KEY,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_cache ENABLE ROW LEVEL SECURITY;
