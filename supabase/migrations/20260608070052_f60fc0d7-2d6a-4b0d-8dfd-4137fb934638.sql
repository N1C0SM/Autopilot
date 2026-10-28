ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_stable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_progressable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS high_tension boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.exercises.is_stable IS 'Hard criterion: exercise allows stable execution (no balance limiting load).';
COMMENT ON COLUMN public.exercises.is_progressable IS 'Hard criterion: load/reps can be progressively overloaded session to session.';
COMMENT ON COLUMN public.exercises.high_tension IS 'Hard criterion: generates high mechanical tension on the target muscle.';