
-- Returns the trainer assigned to the current user (name, photo, email)
CREATE OR REPLACE FUNCTION public.get_my_trainer()
RETURNS TABLE(trainer_id uuid, name text, email text, photo_url text, headline text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id AS trainer_id,
    COALESCE(tp.display_name, p.name, p.email) AS name,
    p.email,
    tp.photo_url,
    tp.headline
  FROM public.trainer_assignments ta
  JOIN public.profiles p ON p.user_id = ta.trainer_id
  LEFT JOIN public.trainer_profiles tp ON tp.user_id = ta.trainer_id
  WHERE ta.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_trainer() TO authenticated;

-- Allow a trainer (or admin) to self-assign a user by email
CREATE OR REPLACE FUNCTION public.trainer_assign_user_by_email(_email text)
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
  IF NOT (public.has_role(_caller, 'trainer'::app_role) OR public.has_role(_caller, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'only trainers can assign users';
  END IF;

  SELECT user_id INTO _user_id FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  -- Replace any existing assignment so a user has at most one trainer
  DELETE FROM public.trainer_assignments WHERE user_id = _user_id;
  INSERT INTO public.trainer_assignments (trainer_id, user_id) VALUES (_caller, _user_id);
  RETURN _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_assign_user_by_email(text) TO authenticated;

-- Allow a trainer to remove one of their own assignments
CREATE OR REPLACE FUNCTION public.trainer_unassign_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.trainer_assignments
   WHERE user_id = _user_id
     AND (trainer_id = _caller OR public.has_role(_caller, 'admin'::app_role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.trainer_unassign_user(uuid) TO authenticated;
