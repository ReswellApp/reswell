-- Link P&L entries to the underlying Reswell order/listing they were attached from.
-- order_num + listing_slug are denormalized snapshots so the ledger stays flat and
-- keeps working even if the source order/listing is later removed.

ALTER TABLE public.pnl_entries
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_role text
    CHECK (order_role IS NULL OR order_role IN ('buyer', 'seller')),
  ADD COLUMN IF NOT EXISTS order_num text,
  ADD COLUMN IF NOT EXISTS listing_slug text;

-- One P&L entry per attached Reswell order.
CREATE UNIQUE INDEX IF NOT EXISTS pnl_entries_order_id_key
  ON public.pnl_entries (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pnl_entries_listing_id_idx
  ON public.pnl_entries (listing_id)
  WHERE listing_id IS NOT NULL;
