DELETE FROM public.progress_photos pp
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id = 'progress-photos'
    AND o.name = regexp_replace(split_part(pp.photo_url, '?', 1), '^.*/progress-photos/', '')
);