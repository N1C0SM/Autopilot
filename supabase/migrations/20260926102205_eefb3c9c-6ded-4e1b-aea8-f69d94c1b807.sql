CREATE POLICY "Admins read library files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins upload library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update library files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete library files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::app_role));