ALTER TABLE public.exercises
  ADD COLUMN exercise_type text,
  ADD COLUMN movement_pattern text,
  ADD COLUMN level integer DEFAULT 1,
  ADD COLUMN priority integer DEFAULT 2,
  ADD COLUMN stimulus_type text,
  ADD COLUMN load_level text,
  ADD COLUMN fatigue_level text,
  ADD COLUMN recommended_order integer DEFAULT 2;