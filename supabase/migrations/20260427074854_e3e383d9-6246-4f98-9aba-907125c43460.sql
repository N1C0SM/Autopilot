
CREATE TABLE public.user_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  busy_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  gym_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  meal_times JSONB NOT NULL DEFAULT '{"breakfast":"08:00","snack_am":"11:00","lunch":"14:00","snack_pm":"17:30","dinner":"21:00"}'::jsonb,
  meal_duration_min INTEGER NOT NULL DEFAULT 30,
  weekly_reminders JSONB NOT NULL DEFAULT '{"weigh_in":true,"progress_photo":true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedule"
ON public.user_schedule
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all schedules"
ON public.user_schedule
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_schedule_updated_at
BEFORE UPDATE ON public.user_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
