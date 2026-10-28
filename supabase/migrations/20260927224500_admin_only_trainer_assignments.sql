REVOKE EXECUTE ON FUNCTION public.trainer_assign_user_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trainer_unassign_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_user_to_trainer(_trainer_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _user_id uuid;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'only admins can assign users to trainers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _trainer_id) THEN
    RAISE EXCEPTION 'trainer profile not found';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_trainer_id, 'trainer'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT user_id INTO _user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  IF _user_id = _trainer_id THEN
    RAISE EXCEPTION 'a trainer cannot be assigned to themselves';
  END IF;
  IF public.has_role(_user_id, 'admin'::app_role) OR public.has_role(_user_id, 'trainer'::app_role) THEN
    RAISE EXCEPTION 'staff cannot be assigned as clients';
  END IF;

  DELETE FROM public.trainer_assignments WHERE user_id = _user_id;
  INSERT INTO public.trainer_assignments (trainer_id, user_id) VALUES (_trainer_id, _user_id);
  RETURN _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_user_to_trainer(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_to_trainer(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.trainer_update_own_profile(text, text);

CREATE OR REPLACE FUNCTION public.trainer_update_own_profile(
  _display_name text,
  _photo_url text,
  _visible boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'trainer'::app_role) THEN
    RAISE EXCEPTION 'only trainers can update their own profile';
  END IF;
  IF length(trim(_display_name)) = 0 OR length(_display_name) > 80 THEN
    RAISE EXCEPTION 'invalid display name';
  END IF;

  INSERT INTO public.trainer_profiles (user_id, display_name, photo_url, visible)
  VALUES (_caller, trim(_display_name), COALESCE(_photo_url, ''), COALESCE(_visible, false))
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        photo_url = EXCLUDED.photo_url,
        visible = EXCLUDED.visible;

  UPDATE public.profiles
  SET name = trim(_display_name),
      avatar_url = COALESCE(_photo_url, '')
  WHERE user_id = _caller;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trainer_update_own_profile(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_update_own_profile(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.trainer_resign()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'trainer'::app_role) THEN
    RAISE EXCEPTION 'only trainers can resign';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trainer_assignments WHERE trainer_id = _caller) THEN
    RAISE EXCEPTION 'assigned_clients_exist';
  END IF;

  DELETE FROM public.trainer_profiles WHERE user_id = _caller;
  DELETE FROM public.user_roles
  WHERE user_id = _caller AND role = 'trainer'::app_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trainer_resign() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_resign() TO authenticated;
