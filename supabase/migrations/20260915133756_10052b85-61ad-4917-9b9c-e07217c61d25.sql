ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cycle_start_date date,
  ADD COLUMN IF NOT EXISTS renewal_decision text,
  ADD COLUMN IF NOT EXISTS renewal_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_prompt_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_renewal_decision_check
  CHECK (renewal_decision IS NULL OR renewal_decision IN ('renovar','completo','pausar'));