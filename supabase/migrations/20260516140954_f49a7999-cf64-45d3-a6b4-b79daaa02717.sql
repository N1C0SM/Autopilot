
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS price_id_training_test TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_training_live TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_full_test TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_full_live TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_transform_test TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_transform_live TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT '';
