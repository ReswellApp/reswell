-- Ensure only real buyers can leave reviews for a seller.
-- This migration tightens the reviews RLS policy so that:
-- - The reviewer must be the authenticated user, AND
-- - That user must have at least one completed purchase from the reviewed seller.

-- Drop the old insert policy if it exists
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;

-- New insert policy: only buyers who purchased from this seller can review
CREATE POLICY "reviews_insert_own"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1
    FROM public.purchases p
    WHERE p.buyer_id = auth.uid()
      AND p.seller_id = reviewed_id
      AND p.status = 'confirmed'
  )
);

