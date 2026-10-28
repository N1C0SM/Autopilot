-- Link progress photos to their scan analysis for easy viewing
ALTER TABLE public.progress_photos
  ADD COLUMN IF NOT EXISTS scan_history_id uuid REFERENCES public.scan_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_progress_photos_scan
  ON public.progress_photos(scan_history_id)
  WHERE scan_history_id IS NOT NULL;
