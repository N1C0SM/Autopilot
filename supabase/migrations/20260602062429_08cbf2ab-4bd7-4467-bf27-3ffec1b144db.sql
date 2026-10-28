
CREATE TABLE public.email_template_overrides (
  template_name TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_template_overrides TO authenticated;
GRANT ALL ON public.email_template_overrides TO service_role;

ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email overrides"
ON public.email_template_overrides FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email overrides"
ON public.email_template_overrides FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email overrides"
ON public.email_template_overrides FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email overrides"
ON public.email_template_overrides FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_template_overrides_updated_at
BEFORE UPDATE ON public.email_template_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
