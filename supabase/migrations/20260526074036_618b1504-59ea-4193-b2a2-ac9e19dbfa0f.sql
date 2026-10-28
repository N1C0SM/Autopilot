
CREATE TABLE IF NOT EXISTS public.scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  current_photo_url text,
  back_photo_url text,
  objective_photo_url text,
  result jsonb NOT NULL,
  attractiveness numeric,
  potential numeric,
  physique numeric,
  style numeric,
  similarity numeric,
  percentile numeric,
  aesthetic_age numeric,
  months_with_plan numeric,
  months_without_plan numeric,
  emailed_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user_taken
  ON public.scan_history(user_id, taken_at DESC);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scan history"
ON public.scan_history
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all scan history"
ON public.scan_history
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trainers view assigned scan history"
ON public.scan_history
FOR SELECT TO authenticated
USING (is_trainer_of(auth.uid(), user_id));
