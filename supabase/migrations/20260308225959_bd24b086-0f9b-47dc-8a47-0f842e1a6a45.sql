ALTER TABLE public.onboarding ADD COLUMN IF NOT EXISTS sex text;
ALTER TABLE public.onboarding ADD COLUMN IF NOT EXISTS injuries text;
ALTER TABLE public.onboarding ADD COLUMN IF NOT EXISTS intensity_level integer DEFAULT 5;