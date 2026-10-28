CREATE TABLE public.library_books (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Nuevo libro',
  description text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT 'Gratis',
  folder text NOT NULL,
  cover_path text,
  file_path text,
  is_pack boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage library books"
ON public.library_books FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read published books"
ON public.library_books FOR SELECT TO authenticated
USING (published = true);

CREATE TRIGGER update_library_books_updated_at
BEFORE UPDATE ON public.library_books
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();