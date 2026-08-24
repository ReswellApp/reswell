-- Optional public “was” price. Sellers opt in when they drop list price so
-- browse/PDP can show the previous amount with a strikethrough.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(12, 2);

COMMENT ON COLUMN public.listings.compare_at_price IS
  'Optional seller-opted “was” price shown with strikethrough when greater than listings.price.';

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_compare_at_price_positive;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_compare_at_price_positive
  CHECK (compare_at_price IS NULL OR compare_at_price > 0);

CREATE OR REPLACE FUNCTION public.listings_clear_stale_compare_at_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.compare_at_price IS NOT NULL
     AND NEW.price IS NOT NULL
     AND NEW.price >= NEW.compare_at_price THEN
    NEW.compare_at_price := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_clear_stale_compare_at_price ON public.listings;

CREATE TRIGGER listings_clear_stale_compare_at_price
  BEFORE INSERT OR UPDATE OF price, compare_at_price
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_clear_stale_compare_at_price();
