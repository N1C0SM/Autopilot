-- Añadir campos de plan anual gestionable desde el admin
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS price_id_yearly_test text DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_id_yearly_live text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_yearly_test text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_link_yearly_live text DEFAULT '',
  ADD COLUMN IF NOT EXISTS yearly_price_eur integer DEFAULT 190;