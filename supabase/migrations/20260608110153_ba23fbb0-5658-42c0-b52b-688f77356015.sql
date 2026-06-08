-- 1. google_calendar_tokens: explicit deny policies (service_role bypasses RLS)
CREATE POLICY "Deny all access to authenticated users"
  ON public.google_calendar_tokens
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 2. scan_leads: add length limits to anon insert
DROP POLICY IF EXISTS "Anyone can insert scan leads" ON public.scan_leads;

CREATE POLICY "Anyone can insert scan leads"
  ON public.scan_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(name, '')) BETWEEN 1 AND 200
    AND length(coalesce(email, '')) BETWEEN 3 AND 255
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(coalesce(whatsapp, '')) <= 50
    AND length(coalesce(goal, '')) <= 2000
  );