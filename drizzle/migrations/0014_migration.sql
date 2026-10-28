ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.get_social_links_public()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT social_links FROM public.settings LIMIT 1), '{}'::jsonb) $$;
GRANT EXECUTE ON FUNCTION public.get_social_links_public() TO anon, authenticated;
UPDATE public.settings SET payment_mode = 'live';