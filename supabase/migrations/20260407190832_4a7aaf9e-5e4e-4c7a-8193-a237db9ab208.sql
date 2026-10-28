CREATE TABLE public.training_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_sets_per_session integer NOT NULL DEFAULT 12,
  max_sets_per_session integer NOT NULL DEFAULT 20,
  series_p1_min integer NOT NULL DEFAULT 3,
  series_p1_max integer NOT NULL DEFAULT 5,
  series_p2_min integer NOT NULL DEFAULT 3,
  series_p2_max integer NOT NULL DEFAULT 4,
  series_p3_min integer NOT NULL DEFAULT 2,
  series_p3_max integer NOT NULL DEFAULT 3,
  reps_fuerza text NOT NULL DEFAULT '4-8',
  reps_hipertrofia text NOT NULL DEFAULT '8-15',
  reps_resistencia text NOT NULL DEFAULT '15-25',
  reps_isometrico text NOT NULL DEFAULT '20-60s',
  rest_fuerza text NOT NULL DEFAULT '180s',
  rest_hipertrofia text NOT NULL DEFAULT '90s',
  rest_resistencia text NOT NULL DEFAULT '45s',
  rest_isometrico text NOT NULL DEFAULT '60s',
  max_consecutive_high_fatigue integer NOT NULL DEFAULT 2,
  max_heavy_hinges integer NOT NULL DEFAULT 1,
  max_pattern_repeats integer NOT NULL DEFAULT 2,
  push_pull_max_diff integer NOT NULL DEFAULT 1,
  max_p2_exercises integer NOT NULL DEFAULT 2,
  max_p3_exercises integer NOT NULL DEFAULT 2,
  required_patterns jsonb NOT NULL DEFAULT '["Empuje","Tirón","Sentadilla","Bisagra","Core"]',
  recovery_hours jsonb NOT NULL DEFAULT '{"Pecho":48,"Espalda":48,"Hombros":48,"Bíceps":36,"Tríceps":36,"Piernas":72,"Glúteos":48,"Core":24,"Cuerpo completo":48,"Cardio":24}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.training_rules DEFAULT VALUES;

ALTER TABLE public.training_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage training rules"
  ON public.training_rules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read training rules"
  ON public.training_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.training_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();