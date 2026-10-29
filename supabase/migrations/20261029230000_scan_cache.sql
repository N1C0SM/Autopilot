-- Scan coherente: la misma foto da siempre el mismo resultado, venga del dispositivo que venga.
-- analyze-physique guarda aquí el primer análisis de cada foto con su huella visual
-- (miniatura 32×32 en grises por vista) y lo reutiliza cuando llega la misma foto.
-- Sin políticas: solo la función (service role) lee y escribe.
CREATE TABLE IF NOT EXISTS public.scan_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  views text NOT NULL,
  aspect real NOT NULL,
  mean real NOT NULL,
  prints jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS scan_cache_lookup_idx ON public.scan_cache (version, views, aspect, mean);
