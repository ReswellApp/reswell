-- Allow buyers to read their own marketplace purchases (history + detail pages).
DROP POLICY IF EXISTS "purchases_select_as_buyer" ON public.purchases;
CREATE POLICY "purchases_select_as_buyer" ON public.purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);
