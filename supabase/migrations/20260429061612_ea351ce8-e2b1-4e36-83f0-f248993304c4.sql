CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expiry_at timestamptz NOT NULL,
  scope text,
  calendar_id text DEFAULT 'primary',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gcal tokens"
ON public.google_calendar_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_gcal_tokens_updated_at
BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();