ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS app_store_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS play_store_url text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.get_public_settings();

CREATE OR REPLACE FUNCTION public.get_public_settings()
 RETURNS TABLE(trainer_name text, trainer_photo_url text, trainer_bio text, contact_email text, yearly_price_eur integer, hero_video_url text, hero_video_poster_url text, app_store_url text, play_store_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT trainer_name, trainer_photo_url, trainer_bio, contact_email, yearly_price_eur, hero_video_url, hero_video_poster_url, app_store_url, play_store_url
  FROM public.settings
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;