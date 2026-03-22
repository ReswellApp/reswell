-- Allow listing owners to update their own images (sort_order, is_primary)
DROP POLICY IF EXISTS "listing_images_update_own" ON public.listing_images;
CREATE POLICY "listing_images_update_own" ON public.listing_images FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND user_id = auth.uid()));
