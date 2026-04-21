-- Tie marketplace seller reviews to the purchase (one review per order) and tighten insert RLS.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.reviews.order_id IS
  'Marketplace purchase this seller review belongs to; at most one review per order.';

CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_id_uidx
  ON public.reviews (order_id)
  WHERE order_id IS NOT NULL;

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;

CREATE POLICY "reviews_insert_own"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND order_id IS NOT NULL
  AND listing_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND o.buyer_id = reviewer_id
      AND o.seller_id = reviewed_id
      AND o.listing_id = listing_id
      AND o.status = 'confirmed'
      AND (
        o.delivery_status = 'delivered'
        OR o.delivery_status = 'picked_up'
      )
  )
);
