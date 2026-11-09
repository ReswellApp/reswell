-- Retire mistaken notification_preferences columns if an earlier draft migration ran.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_preferences'
      AND column_name = 'local_pickup_near_me_enabled'
  ) THEN
    UPDATE public.profiles p
    SET
      browse_home_location = COALESCE(p.browse_home_location, np.local_pickup_near_me_location),
      browse_home_lat = COALESCE(p.browse_home_lat, np.local_pickup_near_me_lat),
      browse_home_lng = COALESCE(p.browse_home_lng, np.local_pickup_near_me_lng),
      browse_home_radius_mi = COALESCE(p.browse_home_radius_mi, np.local_pickup_near_me_radius_mi),
      browse_home_apply_on_boards = CASE
        WHEN p.browse_home_apply_on_boards THEN TRUE
        ELSE COALESCE(np.local_pickup_near_me_enabled, FALSE)
      END,
      browse_home_local_pickup_only = CASE
        WHEN p.browse_home_local_pickup_only THEN TRUE
        ELSE COALESCE(np.local_pickup_near_me_enabled, FALSE)
      END
    FROM public.notification_preferences np
    WHERE np.user_id = p.id
      AND np.local_pickup_near_me_enabled IS TRUE;

    ALTER TABLE public.notification_preferences
      DROP CONSTRAINT IF EXISTS notification_preferences_local_pickup_radius_check;

    ALTER TABLE public.notification_preferences
      DROP COLUMN IF EXISTS local_pickup_near_me_enabled,
      DROP COLUMN IF EXISTS local_pickup_near_me_location,
      DROP COLUMN IF EXISTS local_pickup_near_me_lat,
      DROP COLUMN IF EXISTS local_pickup_near_me_lng,
      DROP COLUMN IF EXISTS local_pickup_near_me_radius_mi;
  END IF;
END $$;
