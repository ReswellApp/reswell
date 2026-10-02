-- Live surfboard listings cannot be priced under $50.
-- Drafts stay unrestricted so incomplete sell forms can autosave.
-- Rows already live under $50 keep their price until that price, status-from-draft,
-- section, or drop floor is changed.

CREATE OR REPLACE FUNCTION public.listings_enforce_surfboard_min_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.section IS DISTINCT FROM 'surfboards' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS NULL OR NEW.price < 50 THEN
    IF TG_OP = 'INSERT'
       OR OLD.price IS DISTINCT FROM NEW.price
       OR OLD.status IS NOT DISTINCT FROM 'draft'
       OR OLD.section IS DISTINCT FROM 'surfboards' THEN
      RAISE EXCEPTION 'Surfboard price must be at least $50.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.auto_price_drop_floor IS NOT NULL AND NEW.auto_price_drop_floor < 50 THEN
    IF TG_OP = 'INSERT'
       OR OLD.auto_price_drop_floor IS DISTINCT FROM NEW.auto_price_drop_floor
       OR OLD.status IS NOT DISTINCT FROM 'draft'
       OR OLD.section IS DISTINCT FROM 'surfboards' THEN
      RAISE EXCEPTION 'Surfboard price-drop floor must be at least $50.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_surfboard_min_price ON public.listings;

CREATE TRIGGER listings_enforce_surfboard_min_price
  BEFORE INSERT OR UPDATE OF price, status, section, auto_price_drop_floor
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_enforce_surfboard_min_price();
