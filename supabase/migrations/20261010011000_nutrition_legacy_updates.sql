-- NOT VALID checks still validate every later UPDATE, including edits to meals
-- or timestamps on a legacy outlier. Preserve those targets until reviewed,
-- while rejecting invalid inserts and any change to nutritional targets.
BEGIN;

ALTER TABLE public.nutrition_plan
  DROP CONSTRAINT IF EXISTS nutrition_plan_targets_review;

CREATE OR REPLACE FUNCTION public.enforce_nutrition_targets_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.nutrition_targets_valid(NEW.macros_json) THEN
      RAISE EXCEPTION 'Review nutritional targets before saving'
        USING ERRCODE = '23514', CONSTRAINT = 'nutrition_plan_targets_review';
    END IF;
  ELSIF NEW.macros_json IS DISTINCT FROM OLD.macros_json THEN
    IF NOT public.nutrition_targets_valid(NEW.macros_json) THEN
      RAISE EXCEPTION 'Review nutritional targets before saving'
        USING ERRCODE = '23514', CONSTRAINT = 'nutrition_plan_targets_review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_nutrition_targets_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_nutrition_targets_write ON public.nutrition_plan;
CREATE TRIGGER enforce_nutrition_targets_write
BEFORE INSERT OR UPDATE ON public.nutrition_plan
FOR EACH ROW EXECUTE FUNCTION public.enforce_nutrition_targets_write();

COMMENT ON TRIGGER enforce_nutrition_targets_write ON public.nutrition_plan IS
  'Validate new or changed targets; retain unchanged legacy targets during meal/metadata edits until coach review.';

COMMIT;
