-- Peer marketplace: multiple surfboards per order (same seller, single Stripe PaymentIntent).
-- Legacy orders have no rows here and remain represented by orders.listing_id only.

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  sort_order int NOT NULL DEFAULT 0,
  item_price numeric(12, 2) NOT NULL CHECK (item_price >= 0),
  shipping_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  platform_fee numeric(12, 2) NOT NULL CHECK (platform_fee >= 0),
  seller_earnings numeric(12, 2) NOT NULL CHECK (seller_earnings >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_order_listing_uidx UNIQUE (order_id, listing_id)
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_listing_id_idx ON public.order_items (listing_id);

COMMENT ON TABLE public.order_items IS
  'Line items for a peer marketplace order (multi-board checkout shares one PaymentIntent / pickup code when offered).';

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select_as_order_party"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
