-- Saved listings per member (shopping cart). One row per listing per buyer.

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_profile_listing_unique UNIQUE (profile_id, listing_id)
);

CREATE INDEX IF NOT EXISTS cart_items_profile_id_idx ON public.cart_items (profile_id);
CREATE INDEX IF NOT EXISTS cart_items_listing_id_idx ON public.cart_items (listing_id);

COMMENT ON TABLE public.cart_items IS
  'Buyer cart: which listings a user saved for later checkout (peer marketplace).';

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own" ON public.cart_items
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own" ON public.cart_items
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own" ON public.cart_items
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());
