
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS show_blog BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_ebooks BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_recommendations BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ebooks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendations JSONB NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.get_public_settings();

CREATE OR REPLACE FUNCTION public.get_public_settings()
 RETURNS TABLE(
   trainer_name text, trainer_photo_url text, trainer_bio text, contact_email text,
   yearly_price_eur integer, hero_video_url text, hero_video_poster_url text,
   app_store_url text, play_store_url text,
   show_blog boolean, show_ebooks boolean, show_recommendations boolean,
   ebooks jsonb, recommendations jsonb
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT trainer_name, trainer_photo_url, trainer_bio, contact_email,
         yearly_price_eur, hero_video_url, hero_video_poster_url,
         app_store_url, play_store_url,
         show_blog, show_ebooks, show_recommendations,
         ebooks, recommendations
  FROM public.settings
  LIMIT 1;
$function$;
