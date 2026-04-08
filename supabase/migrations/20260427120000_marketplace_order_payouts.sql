-- Per-order seller payout record. Created by trigger when an order is inserted.
-- Payout starts as 'held' until the buyer confirms delivery or pickup is verified.

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'held'
    CHECK (
      status IN (
        'held',
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled'
      )
    ),
  hold_reason text
    CHECK (
      hold_reason IS NULL
      OR hold_reason IN (
        'awaiting_shipment',
        'awaiting_delivery',
        'awaiting_pickup'
      )
    ),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payouts_order_id_key UNIQUE (order_id)
);

CREATE INDEX payouts_seller_id_created_idx
  ON public.payouts (seller_id, created_at DESC);

COMMENT ON TABLE public.payouts IS
  'Seller payout obligation per order. Held until fulfillment confirmed, then released for cash-out.';
COMMENT ON COLUMN public.payouts.hold_reason IS
  'Why payout is held: awaiting_shipment (seller needs to ship), awaiting_delivery (shipped, not delivered), awaiting_pickup (local pickup pending).';
COMMENT ON COLUMN public.payouts.released_at IS
  'Timestamp when payout moved from held → pending (funds available for cash-out).';

-- Trigger function: create a held payout row with the right hold_reason based on fulfillment.
CREATE OR REPLACE FUNCTION public.orders_create_pending_payout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payouts (order_id, seller_id, amount, status, hold_reason)
  VALUES (
    NEW.id,
    NEW.seller_id,
    NEW.seller_earnings,
    'held',
    CASE
      WHEN NEW.fulfillment_method = 'shipping' THEN 'awaiting_shipment'
      WHEN NEW.fulfillment_method = 'pickup' THEN 'awaiting_pickup'
      ELSE 'awaiting_shipment'
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_after_insert_pending_payout ON public.orders;
CREATE TRIGGER orders_after_insert_pending_payout
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_create_pending_payout();

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payouts TO service_role;

DROP POLICY IF EXISTS "payouts_select_as_order_party" ON public.payouts;
CREATE POLICY "payouts_select_as_order_party"
  ON public.payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "payouts_insert_as_buyer" ON public.payouts;
CREATE POLICY "payouts_insert_as_buyer"
  ON public.payouts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.buyer_id = auth.uid()
        AND o.seller_id = seller_id
    )
  );
