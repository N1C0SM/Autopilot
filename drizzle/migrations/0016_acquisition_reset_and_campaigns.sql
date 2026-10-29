CREATE OR REPLACE FUNCTION public.admin_reset_acquisition_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  DELETE FROM public.acquisition_events WHERE true;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_acquisition_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_acquisition_events() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_acquisition_campaigns(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from > _to THEN RAISE EXCEPTION 'invalid range'; END IF;

  RETURN (
    WITH excluded AS (
      SELECT user_id FROM public.metrics_excluded_users
      UNION SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'trainer')
    ),
    events AS (
      SELECT e.kind,
             public.acquisition_channel(coalesce(a.source, e.source)) AS channel,
             coalesce(a.medium, e.medium) AS medium,
             coalesce(a.campaign, e.campaign) AS campaign
      FROM public.acquisition_events e
      LEFT JOIN public.user_acquisition a ON a.user_id = e.user_id
      WHERE (e.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN _from AND _to
        AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded))
    ),
    cohort AS (SELECT * FROM public.acquisition_cohort(_from, _to)),
    keys AS (
      SELECT channel, medium, campaign FROM events
      UNION SELECT channel, medium, campaign FROM cohort
    ),
    rows AS (
      SELECT k.channel, k.medium, k.campaign,
        (SELECT count(*) FROM events e WHERE e.channel = k.channel AND e.medium IS NOT DISTINCT FROM k.medium AND e.campaign IS NOT DISTINCT FROM k.campaign AND e.kind = 'visit') AS visits,
        (SELECT count(*) FROM events e WHERE e.channel = k.channel AND e.medium IS NOT DISTINCT FROM k.medium AND e.campaign IS NOT DISTINCT FROM k.campaign AND e.kind = 'scan') AS scans,
        (SELECT count(*) FROM cohort c WHERE c.channel = k.channel AND c.medium IS NOT DISTINCT FROM k.medium AND c.campaign IS NOT DISTINCT FROM k.campaign) AS signups,
        (SELECT count(*) FROM cohort c WHERE c.channel = k.channel AND c.medium IS NOT DISTINCT FROM k.medium AND c.campaign IS NOT DISTINCT FROM k.campaign AND c.first_workout IS NOT NULL) AS first_workout,
        (SELECT count(*) FROM cohort c WHERE c.channel = k.channel AND c.medium IS NOT DISTINCT FROM k.medium AND c.campaign IS NOT DISTINCT FROM k.campaign AND c.week2_eligible AND c.active_week2) AS active_week2,
        (SELECT count(*) FROM cohort c WHERE c.channel = k.channel AND c.medium IS NOT DISTINCT FROM k.medium AND c.campaign IS NOT DISTINCT FROM k.campaign AND c.paid) AS plus
      FROM keys k
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'channel', channel, 'medium', medium, 'campaign', campaign, 'visits', visits, 'scans', scans,
      'signups', signups, 'first_workout', first_workout, 'active_week2', active_week2, 'plus', plus
    ) ORDER BY signups DESC, visits DESC, channel, campaign), '[]'::jsonb)
    FROM rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_acquisition_campaigns(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_acquisition_campaigns(date, date) TO authenticated;