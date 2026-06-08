ALTER TABLE public.goal_physiques
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS goal_physiques_user_id_idx ON public.goal_physiques(user_id);

-- Allow visible public goals (user_id IS NULL) and the user's own goals
DROP POLICY IF EXISTS "Anyone can view visible goal physiques" ON public.goal_physiques;
CREATE POLICY "Anyone can view visible goal physiques"
  ON public.goal_physiques FOR SELECT
  TO anon, authenticated
  USING (visible = true AND user_id IS NULL);

CREATE POLICY "Users can view their own goal physiques"
  ON public.goal_physiques FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal physiques"
  ON public.goal_physiques FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal physiques"
  ON public.goal_physiques FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal physiques"
  ON public.goal_physiques FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);