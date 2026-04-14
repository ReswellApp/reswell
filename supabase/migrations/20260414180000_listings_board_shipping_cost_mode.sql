-- Surfboard listings: how shipping cost is chosen (Reswell vs flat vs free). Used for public /l copy;
-- checkout still uses listing.shipping_price until live rating exists.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS board_shipping_cost_mode text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_board_shipping_cost_mode_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_board_shipping_cost_mode_check
  CHECK (
    board_shipping_cost_mode IS NULL
    OR board_shipping_cost_mode IN ('reswell', 'flat', 'free')
  );

COMMENT ON COLUMN public.listings.board_shipping_cost_mode IS
  'Surfboards: reswell = price set at checkout from buyer address; flat/free = seller-chosen amounts in shipping_price.';
