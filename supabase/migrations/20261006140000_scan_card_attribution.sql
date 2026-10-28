-- Atribución de las tarjetas de escaneo subidas al bucket privado progress-photos.
--
-- Problema: la edge function upload-scan-card guarda las subidas anónimas en
--   progress-photos/scan-cards/anonymous/<uuid>.png
-- sin asociar ningún identificador, así que al borrar una cuenta no hay forma de
-- demostrar qué objetos eran suyos y no se pueden borrar (incumplimiento RGPD:
-- el usuario pide el borrado y su foto sigue en storage).
--
-- Solución: registrar cada subida en este libro mayor con su ruta EXACTA y, o
-- bien el user_id (subida autenticada), o bien el id anónimo de sesión que el
-- navegador genera y envía en la subida. Ese mismo id se adjunta al registrarse
-- en auth.users.raw_user_meta_data.anon_scan_id, de modo que el borrado de
-- cuenta puede eliminar rutas exactas y demostrables, nunca por prefijo amplio.
--
-- Nota importante: los objetos anónimos subidos ANTES de esta migración no son
-- atribuibles retroactivamente (no se guardó ningún identificador). Esta
-- migración no los borra ni puede hacerlo; quedan pendientes de una política de
-- retención (por ejemplo, purgar tarjetas anónimas no reclamadas tras N días).

CREATE TABLE IF NOT EXISTS public.scan_card_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ruta exacta del objeto dentro del bucket progress-photos.
  storage_path text NOT NULL UNIQUE,
  -- Usuario autenticado que subió la tarjeta (NULL en subidas anónimas).
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Id anónimo de sesión: UUID generado en el navegador. Es un secreto de alta
  -- entropía, así que solo quien hizo el escaneo puede reclamar sus rutas.
  anon_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Toda fila debe poder atribuirse a alguien; si no, no se registra.
  CONSTRAINT scan_card_uploads_some_owner
    CHECK (user_id IS NOT NULL OR anon_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS scan_card_uploads_user_idx
  ON public.scan_card_uploads (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scan_card_uploads_anon_idx
  ON public.scan_card_uploads (anon_session_id)
  WHERE anon_session_id IS NOT NULL;

ALTER TABLE public.scan_card_uploads ENABLE ROW LEVEL SECURITY;

-- Sin políticas: solo la service_role (edge functions) lee y escribe esta tabla.
-- El usuario no necesita acceso directo; sus fotos se borran/exportan vía las
-- edge functions con service_role, que no pasa por RLS.
REVOKE ALL ON public.scan_card_uploads FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scan_card_uploads TO service_role;

COMMENT ON TABLE public.scan_card_uploads IS
  'Libro mayor de tarjetas de escaneo subidas a progress-photos. Permite borrar por ruta exacta las fotos anónimas atribuidas a una cuenta (RGPD art. 17).';

COMMENT ON COLUMN public.scan_card_uploads.anon_session_id IS
  'UUID anónimo de sesión generado en el navegador. Se copia a raw_user_meta_data.anon_scan_id al registrarse para poder atribuir la tarjeta a la cuenta.';
