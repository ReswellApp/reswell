-- Brand-new peer listings can hold more than one identical unit.
-- Used listings stay at 1 so each listing's photos describe that item.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_quantity_nonnegative;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_quantity_nonnegative CHECK (quantity >= 0);

COMMENT ON COLUMN public.listings.quantity IS
  'Units remaining on a peer listing. Greater than 1 only when condition is brand_new. Each marketplace sale decrements it and the listing stays active until it hits 0.';

CREATE OR REPLACE FUNCTION public.apply_brand_new_listing_unit_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.inventory_source = 'shopify' THEN
    NEW.quantity := OLD.quantity;
    RETURN NEW;
  END IF;

  -- Reswell shop inventory uses stock_quantity, not this column.
  IF NEW.section = 'new' THEN
    IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      NEW.quantity := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.condition IS DISTINCT FROM 'brand_new' THEN
    NEW.quantity := 1;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      NEW.quantity := 1;
    END IF;
    RETURN NEW;
  END IF;

  -- Checkout sets status to sold and sold_off_platform false without naming a quantity.
  -- That update consumes one brand-new unit. Mark-as-sold sets sold_off_platform true and ends the listing.
  -- Partial sales leave the listing active so leftover units stay buyable.
  -- A checkout sold update after the last unit is already gone must fail, even if status is already sold.
  IF NEW.status = 'sold'
     AND NEW.sold_off_platform IS NOT TRUE
     AND OLD.quantity IS NOT DISTINCT FROM NEW.quantity
  THEN
    IF OLD.status IS DISTINCT FROM 'sold' THEN
      IF COALESCE(OLD.quantity, 1) > 1 THEN
        NEW.quantity := OLD.quantity - 1;
        NEW.status := 'active';
        NEW.sold_off_platform := OLD.sold_off_platform;
        NEW.sold_off_platform_channel := OLD.sold_off_platform_channel;
        NEW.sold_off_platform_detail := OLD.sold_off_platform_detail;
        NEW.sold_off_platform_at := OLD.sold_off_platform_at;
        NEW.sold_reswell_helped_find_buyer := OLD.sold_reswell_helped_find_buyer;
      ELSIF COALESCE(OLD.quantity, 1) = 1 THEN
        NEW.quantity := 0;
      ELSE
        RAISE EXCEPTION 'listing_out_of_stock';
      END IF;
    ELSIF COALESCE(OLD.quantity, 0) < 1 THEN
      RAISE EXCEPTION 'listing_out_of_stock';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM 'sold' AND (NEW.quantity IS NULL OR NEW.quantity < 1) THEN
    NEW.quantity := 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_brand_new_quantity_trigger ON public.listings;
CREATE TRIGGER listings_brand_new_quantity_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_brand_new_listing_unit_sale();

COMMENT ON FUNCTION public.apply_brand_new_listing_unit_sale() IS
  'Keeps listings.quantity at 1 unless condition is brand_new. A checkout sold update decrements one unit and leaves the listing active until none remain.';
