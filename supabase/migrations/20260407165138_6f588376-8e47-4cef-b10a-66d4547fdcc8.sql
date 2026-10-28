ALTER TABLE public.settings
  ADD COLUMN webhook_secret_test text DEFAULT '',
  ADD COLUMN webhook_secret_live text DEFAULT '';