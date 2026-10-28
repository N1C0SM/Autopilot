
-- Table to track completed training days
CREATE TABLE public.day_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_label text NOT NULL,
  completed_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_label, completed_at)
);

ALTER TABLE public.day_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own completions"
ON public.day_completions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
ON public.day_completions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
