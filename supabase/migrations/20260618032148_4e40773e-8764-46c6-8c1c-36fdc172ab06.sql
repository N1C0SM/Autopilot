
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
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'only admins can assign users to trainers';
  END IF;

  -- Ensure trainer exists in profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _trainer_id) THEN
    RAISE EXCEPTION 'trainer profile not found';
  END IF;

  -- Auto-grant trainer role if missing
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

  DELETE FROM public.trainer_assignments WHERE user_id = _user_id;
  INSERT INTO public.trainer_assignments (trainer_id, user_id) VALUES (_trainer_id, _user_id);
  RETURN _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unassign_user_from_trainer(_trainer_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'only admins can unassign';
  END IF;
  DELETE FROM public.trainer_assignments
   WHERE trainer_id = _trainer_id AND user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_trainer_users(_trainer_id uuid)
RETURNS TABLE(user_id uuid, email text, name text, avatar_url text, assigned_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'only admins';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.email, p.name, p.avatar_url, ta.created_at
  FROM public.trainer_assignments ta
  JOIN public.profiles p ON p.user_id = ta.user_id
  WHERE ta.trainer_id = _trainer_id
  ORDER BY ta.created_at DESC;
END;
$$;
