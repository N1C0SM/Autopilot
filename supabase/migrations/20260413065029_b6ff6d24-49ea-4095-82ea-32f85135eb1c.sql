
ALTER TABLE public.exercises ADD COLUMN skill_tag text DEFAULT NULL;
ALTER TABLE public.exercises ADD COLUMN progression_order integer DEFAULT NULL;

CREATE INDEX idx_exercises_skill_tag ON public.exercises (skill_tag) WHERE skill_tag IS NOT NULL;
