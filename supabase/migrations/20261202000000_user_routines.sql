-- Rutinas propias del usuario (biblioteca separada del plan activo).
-- Permite tener más de 7 rutinas: las rutinas ya no ocupan slots del plan hasta que se aplican.

ALTER TABLE public.training_plan
  ADD COLUMN IF NOT EXISTS routines_json jsonb NOT NULL DEFAULT '[]'::jsonb;

-- RLS ya está activo sobre training_plan; no se necesita política nueva (mismo owner).