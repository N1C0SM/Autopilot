CREATE TABLE public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_tokens TO service_role;

ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cron tokens"
ON public.cron_tokens FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_cron_tokens_updated_at
BEFORE UPDATE ON public.cron_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cron_tokens (name) VALUES ('renewal-cycle-check');