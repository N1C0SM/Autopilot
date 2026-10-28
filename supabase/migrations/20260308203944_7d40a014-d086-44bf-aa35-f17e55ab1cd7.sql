
-- Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referral_code text NOT NULL UNIQUE,
  referred_email text,
  referred_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  reward_applied boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE POLICY "Users can create own referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Admins can manage all referrals" ON public.referrals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add subscription_tier to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'none';

-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Add referred_by to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by text;

-- Generate referral code on profile creation
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(random()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Backfill existing profiles with referral codes
UPDATE public.profiles SET referral_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE referral_code IS NULL;
