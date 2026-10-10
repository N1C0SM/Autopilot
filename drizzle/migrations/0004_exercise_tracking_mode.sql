ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS tracking_mode text;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_tracking_mode_check CHECK (tracking_mode IS NULL OR tracking_mode IN ('weighted_reps','bodyweight_reps','weighted_bodyweight','seconds_only','assisted_reps'));
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS video_priority integer;