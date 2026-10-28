CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'referral_code', ''), '')
  );

  IF COALESCE(NEW.raw_user_meta_data->>'is_free', '') = 'true' THEN
    UPDATE public.profiles SET
      payment_status = 'paid',
      subscription_tier = 'personal',
      subscription_status = 'active'
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;