ALTER TABLE public.settings
  ADD COLUMN price_id_test text DEFAULT '',
  ADD COLUMN price_id_live text DEFAULT '',
  ADD COLUMN referral_coupon_id text DEFAULT '';