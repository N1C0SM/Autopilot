CREATE OR REPLACE FUNCTION public.trainer_update_own_profile(_display_name text, _photo_url text, _visible boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(_caller, 'trainer'::app_role) THEN
    RAISE EXCEPTION 'only trainers';
  END IF;

  UPDATE public.profiles SET name = _display_name, avatar_url = _photo_url WHERE user_id = _caller;

  INSERT INTO public.trainer_profiles (user_id, display_name, headline, bio, photo_url, specialty, sort_order, visible)
  VALUES (_caller, _display_name, '', '', COALESCE(_photo_url, ''), '', 0, COALESCE(_visible, false))
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = COALESCE(EXCLUDED.photo_url, trainer_profiles.photo_url),
    visible = EXCLUDED.visible;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trainer_resign()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trainer_assignments WHERE trainer_id = _caller) THEN
    RAISE EXCEPTION 'assigned_clients_exist';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _caller AND role = 'trainer'::app_role;
  DELETE FROM public.trainer_profiles WHERE user_id = _caller;
END;
$function$;