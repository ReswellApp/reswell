-- Private birthday for 18+ marketplace eligibility. Existing rows stay NULL.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Private date of birth for 18+ account eligibility. Null on accounts created before this column existed.';

REVOKE SELECT (date_of_birth) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (date_of_birth) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (date_of_birth) ON public.profiles FROM anon, authenticated;
GRANT SELECT (date_of_birth), UPDATE (date_of_birth) ON public.profiles TO service_role;

-- Copy signup metadata onto the new profile row when Auth creates the user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_name text := trim(COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''));
  local_part text := NULLIF(trim(split_part(NEW.email, '@', 1)), '');
  safe_name text;
  dob date := NULL;
  dob_raw text := trim(COALESCE(NEW.raw_user_meta_data ->> 'date_of_birth', ''));
  profanity_re text := '\m(ass|asses|bastard|bitch|bitches|bullshit|crap|damn|dick|dicks|fuck|fucked|fucker|fucking|hell|shit|shitty|slut|sluts|whore|whores|wtf|piss|pissed|cock|cunt|dumbass|asshole|dipshit|dipstick|jackass|retard|retarded|fag|faggot|nigger|nigga|nazi)\M';
BEGIN
  IF meta_name <> '' AND meta_name NOT LIKE '%@%' AND meta_name !~* profanity_re THEN
    safe_name := meta_name;
  ELSIF local_part <> '' AND local_part NOT LIKE '%@%' AND local_part !~* profanity_re THEN
    safe_name := local_part;
  ELSE
    safe_name := 'User' || left(replace(NEW.id::text, '-', ''), 8);
  END IF;

  IF dob_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN
    BEGIN
      dob := dob_raw::date;
    EXCEPTION WHEN others THEN
      dob := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, date_of_birth)
  VALUES (NEW.id, NEW.email, safe_name, dob)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
