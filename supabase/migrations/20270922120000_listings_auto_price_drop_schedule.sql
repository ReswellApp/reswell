-- When a seller opts into “Drop the price in 2 weeks”, persist when that drop
-- is due. The app cron applies the floor and writes compare_at_price (markdown).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS auto_price_drop_scheduled_for timestamptz;

COMMENT ON COLUMN public.listings.auto_price_drop_scheduled_for IS
  'When the scheduled 2-week auto price drop is due. NULL when auto drop is off or the listing is not yet live.';

-- Existing opted-in live listings: honor the original “two weeks after listed” clock.
UPDATE public.listings
SET auto_price_drop_scheduled_for = created_at + interval '14 days'
WHERE auto_price_drop_floor IS NOT NULL
  AND status = 'active'
  AND auto_price_drop_scheduled_for IS NULL;

CREATE OR REPLACE FUNCTION public.listings_sync_auto_price_drop_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.auto_price_drop_floor IS NULL THEN
    NEW.auto_price_drop_scheduled_for := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' THEN
    IF TG_OP = 'INSERT' OR OLD.auto_price_drop_scheduled_for IS NULL THEN
      NEW.auto_price_drop_scheduled_for := NULL;
    ELSE
      NEW.auto_price_drop_scheduled_for := OLD.auto_price_drop_scheduled_for;
    END IF;
    RETURN NEW;
  END IF;

  -- Active + floor: start the clock if we don't already have one.
  -- Never accept a client-supplied due date (always keep OLD when present).
  IF TG_OP = 'UPDATE'
     AND OLD.auto_price_drop_scheduled_for IS NOT NULL
     AND OLD.auto_price_drop_floor IS NOT NULL THEN
    NEW.auto_price_drop_scheduled_for := OLD.auto_price_drop_scheduled_for;
  ELSE
    NEW.auto_price_drop_scheduled_for := now() + interval '14 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_sync_auto_price_drop_schedule ON public.listings;

CREATE TRIGGER listings_sync_auto_price_drop_schedule
  BEFORE INSERT OR UPDATE OF auto_price_drop_floor, status, auto_price_drop_scheduled_for
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_sync_auto_price_drop_schedule();

CREATE INDEX IF NOT EXISTS listings_auto_price_drop_due_idx
  ON public.listings (auto_price_drop_scheduled_for)
  WHERE auto_price_drop_floor IS NOT NULL
    AND auto_price_drop_scheduled_for IS NOT NULL
    AND status = 'active';
