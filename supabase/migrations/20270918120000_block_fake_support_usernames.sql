-- Block fraudulent "Reswell Support" impersonation usernames
--
-- This migration adds a check constraint to prevent users from setting
-- display names that could be confused with official Reswell support.
-- Only admin accounts are exempt from this restriction.

-- Function to validate display names
CREATE OR REPLACE FUNCTION validate_display_name_not_fake_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lower_name text;
  is_admin_user boolean;
BEGIN
  -- Skip validation if display_name is null or empty
  IF NEW.display_name IS NULL OR trim(NEW.display_name) = '' THEN
    RETURN NEW;
  END IF;

  -- Check if user is admin
  SELECT is_admin INTO is_admin_user
  FROM public.profiles
  WHERE id = NEW.id;

  -- Admin accounts can use any display name
  IF is_admin_user = true THEN
    RETURN NEW;
  END IF;

  -- Normalize the display name for checking
  lower_name := lower(trim(NEW.display_name));

  -- Block variations of "reswell support" and similar impersonation attempts
  IF lower_name SIMILAR TO '%(reswell|res well)%support%'
     OR lower_name SIMILAR TO '%support%(reswell|res well)%'
     OR lower_name SIMILAR TO '%(reswell|res well)%admin%'
     OR lower_name SIMILAR TO '%admin%(reswell|res well)%'
     OR lower_name SIMILAR TO '%(reswell|res well)%team%'
     OR lower_name SIMILAR TO '%team%(reswell|res well)%'
     OR lower_name SIMILAR TO '%(reswell|res well)%official%'
     OR lower_name SIMILAR TO '%official%(reswell|res well)%'
     OR lower_name SIMILAR TO '%(reswell|res well)%staff%'
     OR lower_name SIMILAR TO '%staff%(reswell|res well)%'
     OR lower_name SIMILAR TO '%(reswell|res well)%help%'
     OR lower_name = 'reswell'
     OR lower_name = 'res well'
  THEN
    RAISE EXCEPTION 'This display name is not allowed. Please choose a different name.'
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to validate display_name on INSERT and UPDATE
DROP TRIGGER IF EXISTS validate_display_name_trigger ON public.profiles;
CREATE TRIGGER validate_display_name_trigger
  BEFORE INSERT OR UPDATE OF display_name
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_display_name_not_fake_support();

COMMENT ON FUNCTION validate_display_name_not_fake_support() IS
  'Prevents non-admin users from using display names that could impersonate official Reswell support staff.';

COMMENT ON TRIGGER validate_display_name_trigger ON public.profiles IS
  'Validates display names to prevent fraudulent support account impersonation.';
