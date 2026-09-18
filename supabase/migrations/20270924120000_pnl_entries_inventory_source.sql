-- Inventory source + asking price for the admin balance sheet.
-- source_kind is Reswell vs outside; bought_from is the typed seller/shop/marketplace.

ALTER TABLE public.pnl_entries
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'outside'
    CHECK (source_kind IN ('reswell', 'outside')),
  ADD COLUMN IF NOT EXISTS bought_from text,
  ADD COLUMN IF NOT EXISTS asking_price numeric(12, 2)
    CHECK (asking_price IS NULL OR asking_price >= 0);

CREATE INDEX IF NOT EXISTS pnl_entries_source_kind_idx
  ON public.pnl_entries (source_kind);

UPDATE public.pnl_entries
SET
  source_kind = 'reswell',
  bought_from = COALESCE(NULLIF(BTRIM(bought_from), ''), 'Reswell')
WHERE order_id IS NOT NULL
  AND order_role = 'buyer';

COMMENT ON COLUMN public.pnl_entries.source_kind IS
  'Whether the board was purchased on Reswell or outside the marketplace.';
COMMENT ON COLUMN public.pnl_entries.bought_from IS
  'Free-text source: seller, shop, marketplace, etc.';
COMMENT ON COLUMN public.pnl_entries.asking_price IS
  'Target sell price. Distinct from sale_price, which is the realized sale.';
