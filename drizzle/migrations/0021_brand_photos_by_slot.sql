-- Fotos de marca, v2: si el ejercicio elegido para una foto ya no está en la biblioteca (se borró
-- o se reimportó), se usa el primer ejercicio publicado, por nombre, que encaje con su tipo.
-- Devuelve solo 4 filas (hueco y URL pública), sin exponer el catálogo. Misma lógica que
-- `pickBrandPhotos` (brandPhotos.ts) y `BrandPhotos.pick` (BrandPhotos.swift).
DROP FUNCTION IF EXISTS public.get_brand_photos_public();

CREATE FUNCTION public.get_brand_photos_public()
RETURNS TABLE(slot text, image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH live AS (
    SELECT e.id, e.name, e.image_url
    FROM public.exercises e
    WHERE COALESCE(e.image_url, '') <> '' AND e.status IN ('published', 'archived')
  ),
  slots(slot, pos, preferred, patterns, excludes) AS (VALUES
    ('pullupBar', 1, '7ab0b27f-f296-4fa6-bf07-8f8b026b0832'::uuid, ARRAY['%dominada%'], ARRAY[]::text[]),
    ('dumbbells', 2, 'd5e30e05-0791-4886-84a0-7b2695728225'::uuid, ARRAY['%mancuerna%'], ARRAY[]::text[]),
    ('home', 3, '14988835-a004-49d6-95c5-63978dbce978'::uuid, ARRAY['%goblet%', '%flexi%', '%zancada%'], ARRAY['%mancuerna%']),
    ('gym', 4, 'a31c7206-d2a4-4b31-856a-f5dec09b890e'::uuid, ARRAY['%press%', '%sentadilla%', '%peso%muerto%'], ARRAY['%mancuerna%'])
  )
  SELECT s.slot,
         COALESCE(
           (SELECT l.image_url FROM live l WHERE l.id = s.preferred),
           (SELECT l.image_url FROM live l
             WHERE l.name ILIKE ANY (s.patterns) AND NOT (l.name ILIKE ANY (s.excludes))
             ORDER BY l.name LIMIT 1)
         ) AS image_url
  FROM slots s
  ORDER BY s.pos;
$function$;

REVOKE ALL ON FUNCTION public.get_brand_photos_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_photos_public() TO anon, authenticated;
