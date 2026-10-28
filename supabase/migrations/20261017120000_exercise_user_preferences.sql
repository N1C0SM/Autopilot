-- Preferencias del usuario por ejercicio (cambios y cargas propias) para que no se
-- pierdan al regenerar el plan. La lee `generate-plan` (exercise_user_preferences).
-- Nota: la versión anterior de esta migración se llamaba `0008_exercise_user_preferences.sql`
-- (sin marca de tiempo, así que el CLI nunca la aplicó) y además tenía un subconsulta
-- inválida (`DISTINCT ON (weight)` sobre una columna que no existe). Esta es la buena.

CREATE TABLE IF NOT EXISTS public.exercise_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_exercise_name TEXT NOT NULL,
  -- Si el usuario cambió el ejercicio por otro, aquí queda el sustituto.
  preferred_exercise_name TEXT,
  -- Si el usuario usa una carga propia para este ejercicio, aquí queda.
  preferred_weight TEXT,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, original_exercise_name)
);

CREATE INDEX IF NOT EXISTS idx_exercise_preferences_user
  ON public.exercise_user_preferences(user_id);

ALTER TABLE public.exercise_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own exercise preferences" ON public.exercise_user_preferences;
CREATE POLICY "Users can view their own exercise preferences"
  ON public.exercise_user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own exercise preferences" ON public.exercise_user_preferences;
CREATE POLICY "Users can insert their own exercise preferences"
  ON public.exercise_user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own exercise preferences" ON public.exercise_user_preferences;
CREATE POLICY "Users can update their own exercise preferences"
  ON public.exercise_user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own exercise preferences" ON public.exercise_user_preferences;
CREATE POLICY "Users can delete their own exercise preferences"
  ON public.exercise_user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Al registrar un entrenamiento, guarda la carga que el usuario usó de verdad para ese
-- ejercicio (la más repetida de las series completadas) y así el siguiente plan la respeta.
CREATE OR REPLACE FUNCTION public.update_exercise_preferences_from_logs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.exercise_user_preferences (
    user_id,
    original_exercise_name,
    preferred_weight,
    last_used_at
  )
  VALUES (
    NEW.user_id,
    NEW.exercise_name,
    (
      SELECT s->>'weight'
      FROM jsonb_array_elements(NEW.sets_completed) AS s
      WHERE (s->>'done')::boolean = true
        AND s->>'weight' IS NOT NULL
        AND s->>'weight' <> ''
      GROUP BY s->>'weight'
      ORDER BY COUNT(*) DESC, s->>'weight'
      LIMIT 1
    ),
    NOW()
  )
  ON CONFLICT (user_id, original_exercise_name)
  DO UPDATE SET
    preferred_weight = EXCLUDED.preferred_weight,
    last_used_at = EXCLUDED.last_used_at
  WHERE EXCLUDED.preferred_weight IS NOT NULL
    AND EXCLUDED.preferred_weight <> '';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_exercise_preferences ON public.workout_logs;
CREATE TRIGGER trigger_update_exercise_preferences
  AFTER INSERT OR UPDATE ON public.workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exercise_preferences_from_logs();

COMMENT ON TABLE public.exercise_user_preferences IS 'Cargas y cambios de ejercicio del usuario, para conservarlos al regenerar el plan';
COMMENT ON COLUMN public.exercise_user_preferences.preferred_exercise_name IS 'Sustituto elegido por el usuario para el ejercicio original';
COMMENT ON COLUMN public.exercise_user_preferences.preferred_weight IS 'Carga que el usuario usa de verdad en ese ejercicio';
