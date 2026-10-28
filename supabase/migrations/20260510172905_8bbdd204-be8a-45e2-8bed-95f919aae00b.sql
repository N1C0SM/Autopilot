ALTER TABLE public.onboarding ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS occupation text;