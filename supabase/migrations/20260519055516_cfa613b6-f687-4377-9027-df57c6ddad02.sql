ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payment_link_training_test text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_training_live text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_full_test text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_full_live text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_transform_test text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_transform_live text DEFAULT '';