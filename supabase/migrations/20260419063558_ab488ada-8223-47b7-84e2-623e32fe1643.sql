-- Onboarding: objetivo principal + tests de nivel iniciales
ALTER TABLE public.onboarding
  ADD COLUMN IF NOT EXISTS primary_focus text DEFAULT 'mixto',
  ADD COLUMN IF NOT EXISTS initial_tests jsonb DEFAULT '{}'::jsonb;

-- Workout logs: RPE por sesión (1-10)
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS rpe integer;

-- Day completions: RPE global del día
ALTER TABLE public.day_completions
  ADD COLUMN IF NOT EXISTS rpe integer;

-- Profiles: modo viaje (fecha hasta cuándo está activo) + ubicación viaje
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS travel_mode_until date,
  ADD COLUMN IF NOT EXISTS travel_equipment text;

-- Tabla de PRs (récords personales) — calculada bajo demanda pero cacheada
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exercise_name text NOT NULL,
  weight numeric NOT NULL,
  reps integer NOT NULL,
  estimated_1rm numeric,
  achieved_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_name, weight, reps)
);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own PRs"
ON public.personal_records
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all PRs"
ON public.personal_records
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id, exercise_name);