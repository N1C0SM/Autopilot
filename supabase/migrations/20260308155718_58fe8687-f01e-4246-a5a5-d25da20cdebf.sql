
-- Add payment_status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

-- Create settings table
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_mode text NOT NULL DEFAULT 'test' CHECK (payment_mode IN ('test', 'live')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Admins can read/update settings
CREATE POLICY "Admins can view settings" ON public.settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- All authenticated users can read settings (needed for payment flow)
CREATE POLICY "Authenticated users can read settings" ON public.settings FOR SELECT TO authenticated USING (true);

-- Insert default settings row
INSERT INTO public.settings (payment_mode) VALUES ('test');

-- Add trigger for updated_at on settings
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
