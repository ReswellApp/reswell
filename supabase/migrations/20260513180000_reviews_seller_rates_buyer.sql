-- Allow both parties to leave one marketplace review per order (buyer→seller and seller→buyer).

DROP INDEX IF EXISTS public.reviews_order_id_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_id_reviewer_uidx
  ON public.reviews (order_id, reviewer_id)
  WHERE order_id IS NOT NULL;

COMMENT ON COLUMN public.reviews.order_id IS
  'Marketplace order; one review row per reviewer per order (buyer may rate seller; seller may rate buyer).';

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;

CREATE POLICY "reviews_insert_own"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND order_id IS NOT NULL
  AND listing_id IS NOT NULL
  AND (
    EXISTS (
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
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.seller_id = reviewer_id
        AND o.buyer_id = reviewed_id
        AND o.listing_id = listing_id
        AND o.status = 'confirmed'
        AND (
          o.delivery_status = 'delivered'
          OR o.delivery_status = 'picked_up'
        )
    )
  )
);
