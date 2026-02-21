-- Ensure display_name is never the user's email or profanity (privacy + safety).
--
-- Primary: App requires users to set a display name at sign-up and validates (no profanity, no email).
-- BACKUP: If display name is missing or invalid (OAuth, API, or client bypass), this trigger
-- and backfill ensure we never store email or profanity as username:
--   - New users: trigger assigns a safe display_name (e.g. "User" + first 8 chars of id).
--   - Existing profiles: backfill fixes missing, email-like, or profanity display_name.
-- Do not remove this trigger; it is the safety net so personal info is never displayed.

-- Word-boundary regex for profanity (must match lib/display-name-validation.ts blocklist)
-- \m and \M are start/end of word in PostgreSQL
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
  profanity_re text := '\m(ass|asses|bastard|bitch|bitches|bullshit|crap|damn|dick|dicks|fuck|fucked|fucker|fucking|hell|shit|shitty|slut|sluts|whore|whores|wtf|piss|pissed|cock|cunt|dumbass|asshole|dipshit|dipstick|jackass|retard|retarded|fag|faggot|nigger|nigga|nazi)\M';
BEGIN
  -- Never use full email or profanity; fallback to "User" + id when invalid
  IF meta_name <> '' AND meta_name NOT LIKE '%@%' AND meta_name !~* profanity_re THEN
    safe_name := meta_name;
  ELSIF local_part <> '' AND local_part NOT LIKE '%@%' AND local_part !~* profanity_re THEN
    safe_name := local_part;
  ELSE
    safe_name := 'User' || left(replace(NEW.id::text, '-', ''), 8);
  END IF;

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, safe_name)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill: set safe display_name where missing, empty, email-like, or profanity
UPDATE public.profiles
SET display_name = 'User' || left(replace(id::text, '-', ''), 8)
WHERE display_name IS NULL
   OR trim(display_name) = ''
   OR display_name LIKE '%@%'
   OR display_name ~* '\m(ass|asses|bastard|bitch|bitches|bullshit|crap|damn|dick|dicks|fuck|fucked|fucker|fucking|hell|shit|shitty|slut|sluts|whore|whores|wtf|piss|pissed|cock|cunt|dumbass|asshole|dipshit|dipstick|jackass|retard|retarded|fag|faggot|nigger|nigga|nazi)\M';

-- Sanitize display_name on profile UPDATE (so email/profanity can never be saved via API or direct DB)
CREATE OR REPLACE FUNCTION public.sanitize_profile_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profanity_re text := '\m(ass|asses|bastard|bitch|bitches|bullshit|crap|damn|dick|dicks|fuck|fucked|fucker|fucking|hell|shit|shitty|slut|sluts|whore|whores|wtf|piss|pissed|cock|cunt|dumbass|asshole|dipshit|dipstick|jackass|retard|retarded|fag|faggot|nigger|nigga|nazi)\M';
  new_name text := trim(COALESCE(NEW.display_name, ''));
BEGIN
  IF new_name = '' OR NEW.display_name LIKE '%@%' OR NEW.display_name ~* profanity_re THEN
    NEW.display_name := 'User' || left(replace(NEW.id::text, '-', ''), 8);
  ELSE
    NEW.display_name := new_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_display_name_on_update ON public.profiles;
CREATE TRIGGER sanitize_display_name_on_update
  BEFORE UPDATE OF display_name ON public.profiles
  FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
  EXECUTE FUNCTION public.sanitize_profile_display_name();
