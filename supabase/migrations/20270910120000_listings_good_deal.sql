-- Admin-owned merchandising flag for surfboard listing tiles.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_good_deal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.is_good_deal IS
  'Admin flag: show a Good deal badge while a surfboard listing is purchasable.';

CREATE OR REPLACE FUNCTION public.listings_clear_stale_good_deal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_good_deal = true
     AND (
       NEW.section IS DISTINCT FROM 'surfboards'
       OR NEW.status NOT IN ('active', 'pending_sale')
     ) THEN
    NEW.is_good_deal := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_clear_stale_good_deal ON public.listings;

CREATE TRIGGER listings_clear_stale_good_deal
  BEFORE INSERT OR UPDATE OF section, status, is_good_deal
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_clear_stale_good_deal();
