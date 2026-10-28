
CREATE TABLE public.workout_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_label text NOT NULL,
  exercise_name text NOT NULL,
  sets_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout logs" ON public.workout_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all workout logs" ON public.workout_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
