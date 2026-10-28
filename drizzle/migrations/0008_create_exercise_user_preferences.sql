CREATE TABLE IF NOT EXISTS public.exercise_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  original_exercise_name text NOT NULL,
  preferred_exercise_name text,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unique (user_id, original_exercise_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_user_preferences TO authenticated;
GRANT ALL ON public.exercise_user_preferences TO service_role;

ALTER TABLE public.exercise_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own exercise preferences"
  ON public.exercise_user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own exercise preferences"
  ON public.exercise_user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own exercise preferences"
  ON public.exercise_user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own exercise preferences"
  ON public.exercise_user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.progress_photos ADD COLUMN IF NOT EXISTS scan_history_id uuid;

COMMENT ON COLUMN public.progress_photos.scan_history_id IS 'Enlace opcional a scan_history: foto frontal/espalda guardada desde un scan';