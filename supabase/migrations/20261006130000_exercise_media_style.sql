-- Estado de los medios (imagen/vídeo) de cada ejercicio: versión de estilo,
-- fechas de generación y último error de la cola de generación con IA.
-- La columna media_style_version la fija MEDIA_STYLE_VERSION en la edge function
-- exercise-video; el admin compara ese valor para saber qué medios están obsoletos.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS media_style_version integer,
  ADD COLUMN IF NOT EXISTS image_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_error text;

COMMENT ON COLUMN public.exercises.media_style_version IS
  'Versión del estilo visual con el que se generaron image_url y video_url. La fija MEDIA_STYLE_VERSION en la edge function exercise-video; si es NULL o distinta de la actual, el medio es de un estilo antiguo y conviene regenerarlo.';

COMMENT ON COLUMN public.exercises.image_generated_at IS
  'Momento en que la imagen se generó con IA. NULL si aún no existe o si se subió a mano.';

COMMENT ON COLUMN public.exercises.video_generated_at IS
  'Momento en que el vídeo de técnica se generó con IA. NULL si aún no existe o si es una URL manual.';

COMMENT ON COLUMN public.exercises.media_error IS
  'Último error de la generación de medios con IA. Se limpia cuando la generación se completa.';

-- Índice parcial: solo las filas pendientes de generar o regenerar.
CREATE INDEX IF NOT EXISTS exercises_media_pending_idx
  ON public.exercises (media_style_version)
  WHERE image_url IS NULL
     OR video_url IS NULL
     OR media_style_version IS NULL
     OR media_error IS NOT NULL;
