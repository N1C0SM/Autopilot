DROP POLICY IF EXISTS "Anyone can insert scan leads" ON public.scan_leads;
DROP POLICY IF EXISTS "Public can submit valid scan leads" ON public.scan_leads;
CREATE POLICY "Anyone can insert scan leads"
ON public.scan_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(COALESCE(name, '')) BETWEEN 1 AND 200
  AND length(COALESCE(email, '')) BETWEEN 3 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(COALESCE(whatsapp, '')) <= 50
  AND length(COALESCE(goal, '')) <= 2000
);