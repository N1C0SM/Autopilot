-- Fotos de marca (landing, bienvenida y portadas de la app): son las fotos de 4 ejercicios de la
-- biblioteca. Su URL cambia cada vez que el admin regenera la foto o la pasa a WebP, y la anterior
-- se borra del bucket, así que los clientes la piden aquí por id (también sin sesión).
-- Solo devuelve esas 4 URLs, que ya son públicas en `site-assets`.
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
  AND COALESCE(e.image_url, '') <> '';
$function$;

REVOKE ALL ON FUNCTION public.get_brand_photos_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_photos_public() TO anon, authenticated;
