-- Preserve existing targets for coach review. NOT VALID intentionally avoids
-- rewriting or deleting legacy plans while enforcing all new/changed rows.
CREATE OR REPLACE FUNCTION public.nutrition_targets_valid(targets jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  key text;
  amount numeric;
  max_amount numeric;
  calculated numeric;
  calories numeric;
BEGIN
  IF targets IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(targets) <> 'object' THEN RETURN false; END IF;
  IF coalesce(targets->>'protein', '') = '' AND coalesce(targets->>'carbs', '') = '' AND coalesce(targets->>'fats', '') = '' THEN
    RETURN true;
  END IF;
  FOREACH key IN ARRAY ARRAY['protein', 'carbs', 'fats'] LOOP
    IF coalesce(targets->>key, '') !~ '^[0-9]+([.][0-9]+)?$' THEN RETURN false; END IF;
    amount := (targets->>key)::numeric;
    max_amount := CASE key WHEN 'protein' THEN 350 WHEN 'carbs' THEN 700 ELSE 180 END;
    IF amount <= 0 OR amount > max_amount THEN RETURN false; END IF;
  END LOOP;
  IF coalesce(targets->>'calories', '') <> '' THEN
    IF targets->>'calories' !~ '^[0-9]+([.][0-9]+)?$' THEN RETURN false; END IF;
    calories := (targets->>'calories')::numeric;
    calculated := (targets->>'protein')::numeric * 4 + (targets->>'carbs')::numeric * 4 + (targets->>'fats')::numeric * 9;
    IF calories <= 0 OR abs(calories - calculated) > greatest(50, calculated * 0.1) THEN RETURN false; END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
  RETURN false;
END;
$$;

ALTER TABLE public.nutrition_plan
  ADD CONSTRAINT nutrition_plan_targets_review CHECK (public.nutrition_targets_valid(macros_json)) NOT VALID;

COMMENT ON CONSTRAINT nutrition_plan_targets_review ON public.nutrition_plan IS
  'Product data-quality limits. Existing outliers remain unchanged and require coach review; not dietary advice.';
