ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS apk_download_enabled boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.get_apk_download_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT apk_download_enabled FROM public.settings LIMIT 1), true);
$$;
GRANT EXECUTE ON FUNCTION public.get_apk_download_enabled() TO anon, authenticated;