
CREATE TABLE public.scan_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NULL,
  goal TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  result JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (anon included) can submit a lead
CREATE POLICY "Anyone can insert scan leads"
ON public.scan_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read leads
CREATE POLICY "Admins can read scan leads"
ON public.scan_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_scan_leads_created_at ON public.scan_leads(created_at DESC);
