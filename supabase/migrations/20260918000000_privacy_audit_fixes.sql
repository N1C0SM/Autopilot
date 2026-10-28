-- 1) Set progress-photos bucket to private to ensure RLS is enforced for all access
UPDATE storage.buckets SET public = false WHERE id = 'progress-photos';

-- 2) Add missing ON DELETE CASCADE constraints for scan-related tables
-- This ensures that if a user is deleted, their sensitive scan data is removed even if the edge function fails.

-- First, scan_history
ALTER TABLE public.scan_history 
  DROP CONSTRAINT IF EXISTS scan_history_user_id_fkey,
  ADD CONSTRAINT scan_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Second, scan_leads
ALTER TABLE public.scan_leads
  DROP CONSTRAINT IF EXISTS scan_leads_user_id_fkey,
  ADD CONSTRAINT scan_leads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3) Harden scan_leads INSERT policy (currently WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can insert scan leads" ON public.scan_leads;
CREATE POLICY "Public can submit valid scan leads"
ON public.scan_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (email IS NULL OR (char_length(email) BETWEEN 5 AND 256 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
  AND char_length(name) > 0
  AND char_length(whatsapp) > 0
);
