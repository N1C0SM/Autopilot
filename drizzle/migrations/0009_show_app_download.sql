ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS show_app_download boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_public_settings();

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE(
  trainer_name text, trainer_photo_url text, trainer_bio text, contact_email text,
  yearly_price_eur integer, hero_video_url text, hero_video_poster_url text,
  app_store_url text, play_store_url text, show_blog boolean, show_ebooks boolean,
  show_recommendations boolean, ebooks jsonb, recommendations jsonb, guide_ebook_url text,
  booking_url text, transformation_slots integer, landing_ebooks_count integer,
  landing_recommendations_count integer, show_app_download boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT trainer_name, trainer_photo_url, trainer_bio, contact_email,
         yearly_price_eur, hero_video_url, hero_video_poster_url,
         app_store_url, play_store_url,
         show_blog, show_ebooks, show_recommendations,
         ebooks, recommendations,
         COALESCE(guide_ebook_url, '') AS guide_ebook_url,
         COALESCE(booking_url, '') AS booking_url,
         COALESCE(transformation_slots, 10) AS transformation_slots,
         COALESCE(landing_ebooks_count, 4) AS landing_ebooks_count,
         COALESCE(landing_recommendations_count, 3) AS landing_recommendations_count,
         COALESCE(show_app_download, true) AS show_app_download
  FROM public.settings
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;