-- Shop "new" stock lives on listings; replaces public.inventory (1:1 listing_id).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.listings.stock_quantity IS
  'Units in stock for section=new marketplace listings; 0 for surfboards or sold-out new items.';

UPDATE public.listings l
SET stock_quantity = GREATEST(0, i.quantity)
FROM public.inventory i
WHERE i.listing_id = l.id;

DROP POLICY IF EXISTS "inventory_select_public" ON public.inventory;

DROP TABLE IF EXISTS public.inventory;
