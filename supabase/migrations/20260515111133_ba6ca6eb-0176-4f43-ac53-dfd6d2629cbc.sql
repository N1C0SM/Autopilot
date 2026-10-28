
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE(paid_count bigint, active_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles WHERE payment_status = 'paid')::bigint,
    (SELECT count(*) FROM public.profiles WHERE payment_status = 'paid' AND subscription_status = 'active')::bigint;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;
