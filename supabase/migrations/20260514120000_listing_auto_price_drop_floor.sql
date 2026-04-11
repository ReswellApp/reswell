-- Minimum list price after the 2-week auto drop (seller-defined). NULL when auto drop is off or unset.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS auto_price_drop_floor DECIMAL(10, 2);

COMMENT ON COLUMN public.listings.auto_price_drop_floor IS 'Minimum list price after scheduled auto drop; NULL when not used.';
