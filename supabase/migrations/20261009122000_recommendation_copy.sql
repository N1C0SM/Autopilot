-- Correct only the two audited descriptions. Keep every other field, item and
-- array position, and leave subsequent edits by the site owner untouched.
UPDATE public.settings AS settings
SET recommendations = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'title' = 'MyProtein Creatina Monohidrato · 500 g'
        AND item->>'description' = 'La forma más práctica y económica de asegurar tus requerimientos de proteína diarios cuando no llegas solo con comida sólida.'
      THEN jsonb_set(item, '{description}', to_jsonb('Creatina monohidrato para complementar tu entrenamiento. Consulta la etiqueta para conocer composición y modo de uso.'::text))
      WHEN item->>'title' = 'MyProtein Impact Whey · 900 g'
        AND item->>'description' = 'El suplemento con mayor respaldo científico del mundo para ganar fuerza explosiva y rendimiento en series pesadas.'
      THEN jsonb_set(item, '{description}', to_jsonb('Proteína de suero para complementar la ingesta de proteína cuando la alimentación no cubre tus necesidades. Consulta la etiqueta y los alérgenos.'::text))
      ELSE item
    END ORDER BY position
  )
  FROM jsonb_array_elements(settings.recommendations) WITH ORDINALITY AS recommendation(item, position)
)
WHERE jsonb_typeof(settings.recommendations) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(settings.recommendations) = 'array' THEN settings.recommendations ELSE '[]'::jsonb END
    ) AS recommendation(item)
    WHERE (
      item->>'title' = 'MyProtein Creatina Monohidrato · 500 g'
      AND item->>'description' = 'La forma más práctica y económica de asegurar tus requerimientos de proteína diarios cuando no llegas solo con comida sólida.'
    ) OR (
      item->>'title' = 'MyProtein Impact Whey · 900 g'
      AND item->>'description' = 'El suplemento con mayor respaldo científico del mundo para ganar fuerza explosiva y rendimiento en series pesadas.'
    )
  );
