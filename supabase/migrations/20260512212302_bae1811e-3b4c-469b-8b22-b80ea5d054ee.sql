-- ============================================================
-- TRAINER ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trainer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- 1 trainer per user
);

ALTER TABLE public.trainer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trainer assignments"
  ON public.trainer_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Trainers view own assignments"
  ON public.trainer_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_id);

CREATE POLICY "Users view own assignment"
  ON public.trainer_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_trainer ON public.trainer_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_user ON public.trainer_assignments(user_id);

-- ============================================================
-- TRAINER PROFILES (public landing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trainer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible trainer profiles"
  ON public.trainer_profiles FOR SELECT
  TO public
  USING (visible = true);

CREATE POLICY "Admins manage trainer profiles"
  ON public.trainer_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Trainers view own profile"
  ON public.trainer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Trainers update own profile"
  ON public.trainer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_trainer_profiles_updated_at
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_trainer_of(_trainer_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_assignments
    WHERE trainer_id = _trainer_id AND user_id = _user_id
  )
$$;

-- ============================================================
-- RLS POLICIES — Trainers can access assigned users' data
-- ============================================================

-- profiles
CREATE POLICY "Trainers view assigned users profile"
  ON public.profiles FOR SELECT
  USING (public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Trainers update assigned users profile"
  ON public.profiles FOR UPDATE
  USING (public.is_trainer_of(auth.uid(), user_id));

-- onboarding
CREATE POLICY "Trainers view assigned users onboarding"
  ON public.onboarding FOR SELECT
  USING (public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Trainers update assigned users onboarding"
  ON public.onboarding FOR UPDATE
  USING (public.is_trainer_of(auth.uid(), user_id));

-- training_plan
CREATE POLICY "Trainers manage assigned users training plan"
  ON public.training_plan FOR ALL
  USING (public.is_trainer_of(auth.uid(), user_id))
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- nutrition_plan
CREATE POLICY "Trainers manage assigned users nutrition plan"
  ON public.nutrition_plan FOR ALL
  USING (public.is_trainer_of(auth.uid(), user_id))
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- workout_logs
CREATE POLICY "Trainers view assigned users workout logs"
  ON public.workout_logs FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

-- day_completions
CREATE POLICY "Trainers view assigned users completions"
  ON public.day_completions FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

-- weight_logs
CREATE POLICY "Trainers view assigned users weight logs"
  ON public.weight_logs FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

-- personal_records
CREATE POLICY "Trainers view assigned users PRs"
  ON public.personal_records FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

-- progress_photos
CREATE POLICY "Trainers view assigned users photos"
  ON public.progress_photos FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

-- external_activities
CREATE POLICY "Trainers manage assigned users external activities"
  ON public.external_activities FOR ALL
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id))
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- user_schedule
CREATE POLICY "Trainers manage assigned users schedule"
  ON public.user_schedule FOR ALL
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id))
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- training_schedule_overrides
CREATE POLICY "Trainers manage assigned users overrides"
  ON public.training_schedule_overrides FOR ALL
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id))
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- notifications
CREATE POLICY "Trainers view assigned users notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.is_trainer_of(auth.uid(), user_id));

CREATE POLICY "Trainers create notifications for assigned users"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_trainer_of(auth.uid(), user_id));

-- chat_messages: trainers can chat with assigned users + with admin
CREATE POLICY "Trainers view assigned users chat"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    public.is_trainer_of(auth.uid(), conversation_user_id)
    OR (auth.uid() = conversation_user_id AND public.has_role(auth.uid(), 'trainer'))
  );

CREATE POLICY "Trainers send chat to assigned users or admin"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_trainer_of(auth.uid(), conversation_user_id)
      OR (auth.uid() = conversation_user_id AND public.has_role(auth.uid(), 'trainer'))
    )
  );