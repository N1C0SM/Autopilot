ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS buy_url_test text, ADD COLUMN IF NOT EXISTS buy_url_live text;
UPDATE public.library_books SET buy_url_test = buy_url WHERE buy_url ILIKE '%/test_%' AND buy_url_test IS NULL;
UPDATE public.library_books SET buy_url_live = buy_url WHERE buy_url IS NOT NULL AND buy_url NOT ILIKE '%/test_%' AND buy_url_live IS NULL;

CREATE OR REPLACE FUNCTION public.get_payment_mode()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE(payment_mode, 'test') FROM public.settings LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.get_payment_mode() TO anon, authenticated;