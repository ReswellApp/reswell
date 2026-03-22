-- Peer listing card checkouts: store buyer fulfillment choice; allow sellers to read their sales.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_fulfillment_method_check;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_fulfillment_method_check
  CHECK (fulfillment_method IS NULL OR fulfillment_method IN ('pickup', 'shipping'));

COMMENT ON COLUMN public.purchases.fulfillment_method IS
  'Buyer fulfillment for peer listing card checkouts: pickup vs shipping';

DROP POLICY IF EXISTS "purchases_select_as_seller" ON public.purchases;
CREATE POLICY "purchases_select_as_seller" ON public.purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);
