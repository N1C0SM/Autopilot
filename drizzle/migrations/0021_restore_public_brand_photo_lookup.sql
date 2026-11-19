CREATE OR REPLACE FUNCTION public.get_brand_photos_public()
RETURNS TABLE(id uuid, image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.image_url
  FROM public.exercises e
  WHERE e.id IN (
    'a31c7206-d2a4-4b31-856a-f5dec09b890e'::uuid,
    'd5e30e05-0791-4886-84a0-7b2695728225'::uuid,
    '14988835-a004-49d6-95c5-63978dbce978'::uuid,
    '7ab0b27f-f296-4fa6-bf07-8f8b026b0832'::uuid
  )
  AND e.status IN ('published', 'archived')
  AND COALESCE(e.image_url, '') <> '';
$function$;
REVOKE ALL ON FUNCTION public.get_brand_photos_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_photos_public() TO anon, authenticated, service_role;