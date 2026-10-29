-- Captación: de qué red social llega cada usuario y cómo avanza por el embudo.
-- Primer contacto por cuenta (user_acquisition) y visitas/scans anónimos por
-- fuente (acquisition_events). Sin datos personales: solo fuente, medio y campaña.
-- Lectura solo para admins y siempre agregada vía admin_acquisition_funnel.

CREATE TABLE IF NOT EXISTS public.user_acquisition (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source text,
  medium text,
  campaign text,
  landing_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('visit', 'scan')),
  source text,
  medium text,
  campaign text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acquisition_events_created_idx ON public.acquisition_events (created_at);

ALTER TABLE public.user_acquisition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisition_events ENABLE ROW LEVEL SECURITY;

-- Nadie escribe directamente: solo las funciones de abajo, que limpian la entrada.
REVOKE ALL ON public.user_acquisition FROM anon, authenticated;
REVOKE ALL ON public.acquisition_events FROM anon, authenticated;
GRANT SELECT ON public.user_acquisition, public.acquisition_events TO authenticated;

DROP POLICY IF EXISTS "Admins read acquisition" ON public.user_acquisition;
CREATE POLICY "Admins read acquisition" ON public.user_acquisition
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins read acquisition events" ON public.acquisition_events;
CREATE POLICY "Admins read acquisition events" ON public.acquisition_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Texto corto, en minúsculas y sin vacíos.
CREATE OR REPLACE FUNCTION public.acquisition_clean(_value text, _max integer DEFAULT 64)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(left(lower(btrim(coalesce(_value, ''))), _max), '')
$$;

-- Agrupa cualquier utm_source/ref/referrer en las redes que medimos.
CREATE OR REPLACE FUNCTION public.acquisition_channel(_source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _source IS NULL OR btrim(_source) = '' THEN 'directo'
    WHEN lower(_source) ~ '(tiktok|^tt$)' THEN 'tiktok'
    WHEN lower(_source) ~ '(instagram|^ig$|^insta$)' THEN 'instagram'
    WHEN lower(_source) ~ '(youtube|youtu\.be|^yt$)' THEN 'youtube'
    WHEN lower(_source) ~ 'threads' THEN 'threads'
    WHEN lower(_source) ~ '(facebook|^fb$|fb\.com|fb\.me)' THEN 'facebook'
    ELSE 'otros'
  END
$$;

-- Visita nueva o scan, con o sin sesión. El user_id sale de la sesión, nunca del cliente.
CREATE OR REPLACE FUNCTION public.record_acquisition_event(_kind text, _source text DEFAULT NULL, _medium text DEFAULT NULL, _campaign text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind NOT IN ('visit', 'scan') THEN RAISE EXCEPTION 'invalid acquisition event'; END IF;
  INSERT INTO public.acquisition_events (kind, source, medium, campaign, user_id)
  VALUES (_kind, public.acquisition_clean(_source), public.acquisition_clean(_medium), public.acquisition_clean(_campaign, 100), auth.uid());
END;
$$;

-- Respaldo para altas sin metadatos (Google/Apple): solo la propia cuenta,
-- una vez, y solo si se creó hace menos de 7 días (no reescribe historia).
CREATE OR REPLACE FUNCTION public.claim_acquisition(_source text DEFAULT NULL, _medium text DEFAULT NULL, _campaign text DEFAULT NULL, _landing text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND created_at > now() - interval '7 days') THEN RETURN; END IF;
  INSERT INTO public.user_acquisition (user_id, source, medium, campaign, landing_path)
  VALUES (_uid, public.acquisition_clean(_source), public.acquisition_clean(_medium), public.acquisition_clean(_campaign, 100), public.acquisition_clean(_landing, 120))
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Alta con email: el origen viaja en los metadatos (acq_*) y se guarda al crear el usuario.
CREATE OR REPLACE FUNCTION public.handle_new_user_acquisition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF _meta ? 'acq_landing' OR _meta ? 'acq_source' THEN
    INSERT INTO public.user_acquisition (user_id, source, medium, campaign, landing_path)
    VALUES (NEW.id, public.acquisition_clean(_meta->>'acq_source'), public.acquisition_clean(_meta->>'acq_medium'),
            public.acquisition_clean(_meta->>'acq_campaign', 100), public.acquisition_clean(_meta->>'acq_landing', 120))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- La medición nunca bloquea un alta.
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_acquisition ON auth.users;
CREATE TRIGGER on_auth_user_created_acquisition
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_acquisition();

-- Embudo por red y rango de fechas (hora de Madrid). Excluye admins, entrenadores
-- y cuentas de prueba (metrics_excluded_users). «Activo 2ª semana» = al menos un
-- entreno registrado entre los días 8 y 14 desde el alta; solo cuenta a quien ya
-- cumplió esos 14 días (week2_eligible).
CREATE OR REPLACE FUNCTION public.admin_acquisition_funnel(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := (now() AT TIME ZONE 'Europe/Madrid')::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from > _to THEN RAISE EXCEPTION 'invalid range'; END IF;

  RETURN (
    WITH excluded AS (
      SELECT user_id FROM public.metrics_excluded_users
      UNION SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'trainer')
    ),
    channels(channel, ord) AS (
      VALUES ('tiktok', 1), ('instagram', 2), ('youtube', 3), ('threads', 4), ('facebook', 5), ('otros', 6), ('directo', 7)
    ),
    events AS (
      SELECT e.kind, public.acquisition_channel(coalesce(a.source, e.source)) AS channel
      FROM public.acquisition_events e
      LEFT JOIN public.user_acquisition a ON a.user_id = e.user_id
      WHERE (e.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN _from AND _to
        AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded))
    ),
    cohort AS (
      SELECT p.user_id,
             (p.created_at AT TIME ZONE 'Europe/Madrid')::date AS signup_day,
             public.acquisition_channel(a.source) AS channel,
             (p.payment_status = 'paid'
               AND p.subscription_tier IN ('training', 'plus', 'full', 'transform', 'personal', 'coach')
               AND (p.stripe_payment_id IS NOT NULL
                    OR (p.subscription_status IN ('active', 'trialing') AND (p.subscription_end IS NULL OR p.subscription_end > now())))) AS paid
      FROM public.profiles p
      LEFT JOIN public.user_acquisition a ON a.user_id = p.user_id
      WHERE (p.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN _from AND _to
        AND p.user_id NOT IN (SELECT user_id FROM excluded)
    ),
    cohort_week2 AS (
      SELECT c.*,
             c.signup_day + 13 < _today AS eligible,
             EXISTS (SELECT 1 FROM public.day_completions d
                     WHERE d.user_id = c.user_id AND d.completed_at BETWEEN c.signup_day + 7 AND c.signup_day + 13) AS active_week2
      FROM cohort c
    ),
    rows AS (
      SELECT ch.channel, ch.ord,
        (SELECT count(*) FROM events e WHERE e.channel = ch.channel AND e.kind = 'visit') AS visits,
        (SELECT count(*) FROM events e WHERE e.channel = ch.channel AND e.kind = 'scan') AS scans,
        (SELECT count(*) FROM cohort_week2 c WHERE c.channel = ch.channel) AS signups,
        (SELECT count(*) FROM cohort_week2 c WHERE c.channel = ch.channel AND c.eligible) AS week2_eligible,
        (SELECT count(*) FROM cohort_week2 c WHERE c.channel = ch.channel AND c.eligible AND c.active_week2) AS active_week2,
        (SELECT count(*) FROM cohort_week2 c WHERE c.channel = ch.channel AND c.paid) AS plus
      FROM channels ch
    )
    SELECT jsonb_build_object(
      'from', _from,
      'to', _to,
      'tracking_since', (SELECT min(created_at) FROM public.acquisition_events),
      'channels', coalesce(jsonb_agg(jsonb_build_object(
        'channel', channel, 'visits', visits, 'scans', scans, 'signups', signups,
        'week2_eligible', week2_eligible, 'active_week2', active_week2, 'plus', plus
      ) ORDER BY ord), '[]'::jsonb)
    )
    FROM rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_acquisition_event(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_acquisition(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_acquisition_funnel(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_acquisition() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_acquisition_event(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_acquisition(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_acquisition_funnel(date, date) TO authenticated;
