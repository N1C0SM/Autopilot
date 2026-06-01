-- 1) Proteger el token de calendar_tokens: el usuario no puede cambiarlo vía UPDATE
CREATE OR REPLACE FUNCTION public.prevent_calendar_token_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo el service_role puede regenerar el token
  IF NEW.token IS DISTINCT FROM OLD.token AND auth.role() <> 'service_role' THEN
    NEW.token := OLD.token;
  END IF;
  -- El user_id tampoco se puede cambiar
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND auth.role() <> 'service_role' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_calendar_token_change_trg ON public.calendar_tokens;
CREATE TRIGGER prevent_calendar_token_change_trg
BEFORE UPDATE ON public.calendar_tokens
FOR EACH ROW
EXECUTE FUNCTION public.prevent_calendar_token_change();

-- Política SELECT para admins (auditoría sin modificar)
CREATE POLICY "Admins can view calendar tokens"
ON public.calendar_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Restringir suscripciones a Realtime: solo autenticados pueden suscribirse
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
