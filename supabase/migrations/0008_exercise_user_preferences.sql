-- Table to store user preferences for exercises (swaps, custom weights, etc.)
-- This preserves user choices when regenerating plans

CREATE TABLE IF NOT EXISTS exercise_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_exercise_name TEXT NOT NULL,
  -- If user swapped this exercise for another, store the replacement
  preferred_exercise_name TEXT,
  -- If user set a custom weight for this exercise, store it
  preferred_weight TEXT,
  -- Track when this preference was last used
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one preference per user per exercise
  UNIQUE(user_id, original_exercise_name)
);

-- Index for fast lookups when generating plans
CREATE INDEX IF NOT EXISTS idx_exercise_preferences_user 
  ON exercise_user_preferences(user_id);

-- RLS policies
ALTER TABLE exercise_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exercise preferences"
  ON exercise_user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise preferences"
  ON exercise_user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise preferences"
  ON exercise_user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise preferences"
  ON exercise_user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update preferences from workout logs
-- This runs after each workout to extract user preferences
CREATE OR REPLACE FUNCTION update_exercise_preferences_from_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- If the logged exercise weight is different from the plan's default,
  -- save it as a preference
  INSERT INTO exercise_user_preferences (
    user_id,
    original_exercise_name,
    preferred_weight,
    last_used_at
  )
  VALUES (
    NEW.user_id,
    NEW.exercise_name,
    -- Extract the most common weight from completed sets
    (
      SELECT DISTINCT ON (weight) weight
      FROM jsonb_array_elements(NEW.sets_completed) AS set
      WHERE (set->>'done')::boolean = true
        AND set->>'weight' IS NOT NULL
        AND set->>'weight' != ''
      GROUP BY set->>'weight'
      ORDER BY set->>'weight', COUNT(*) DESC
      LIMIT 1
    ),
    NEW.logged_at
  )
  ON CONFLICT (user_id, original_exercise_name)
  DO UPDATE SET
    preferred_weight = EXCLUDED.preferred_weight,
    last_used_at = EXCLUDED.last_used_at
  WHERE EXCLUDED.preferred_weight IS NOT NULL
    AND EXCLUDED.preferred_weight != '';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update preferences after each workout log
CREATE TRIGGER trigger_update_exercise_preferences
  AFTER INSERT OR UPDATE ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_exercise_preferences_from_logs();

COMMENT ON TABLE exercise_user_preferences IS 'Stores user preferences for exercises (swaps, custom weights) to preserve choices across plan regenerations';
COMMENT ON COLUMN exercise_user_preferences.preferred_exercise_name IS 'If user swapped the original exercise, this is the replacement they chose';
COMMENT ON COLUMN exercise_user_preferences.preferred_weight IS 'Custom weight the user consistently uses for this exercise';
