-- Extend the fake-support username trigger to also match reversed
-- "help … reswell" / "help … res well". The original migration only
-- blocked reswell/res well followed by help. Do not rewrite
-- 20270918120000_block_fake_support_usernames.sql; it is already applied.

CREATE OR REPLACE FUNCTION validate_display_name_not_fake_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lower_name text;
  is_admin_user boolean;
BEGIN
  IF NEW.display_name IS NULL OR trim(NEW.display_name) = '' THEN
    RETURN NEW;
  END IF;

  SELECT is_admin INTO is_admin_user
  FROM public.profiles
  WHERE id = NEW.id;

  IF is_admin_user = true THEN
    RETURN NEW;
  END IF;

  lower_name := lower(trim(NEW.display_name));

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
     OR lower_name SIMILAR TO '%help%(reswell|res well)%'
     OR lower_name = 'reswell'
     OR lower_name = 'res well'
  THEN
    RAISE EXCEPTION 'This display name is not allowed. Please choose a different name.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_display_name_not_fake_support() IS
  'Prevents non-admin users from using display names that could impersonate official Reswell support staff.';
