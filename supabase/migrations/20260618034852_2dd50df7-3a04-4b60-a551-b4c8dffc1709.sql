-- Tabla de registro de consentimientos del usuario (RGPD).
-- Cada vez que el usuario acepta o retira un consentimiento, se inserta una fila.
CREATE TABLE public.user_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- p.ej. 'terms', 'privacy', 'health_data', 'cookies_analytics', 'marketing'
  granted BOOLEAN NOT NULL,
  document_version TEXT,       -- versión del documento aceptado
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_consents_user ON public.user_consents(user_id, consent_type, created_at DESC);

GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- El usuario puede ver y crear sus propios consentimientos.
CREATE POLICY "Users can view their own consents"
ON public.user_consents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consents"
ON public.user_consents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Administradores pueden auditar todos los consentimientos.
CREATE POLICY "Admins can view all consents"
ON public.user_consents FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));