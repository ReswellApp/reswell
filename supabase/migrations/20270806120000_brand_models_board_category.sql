-- Surfboard shape tag for catalog brand models. Drives the /sell boards
-- "Board shape / category" prefill when a seller picks a catalog model.
-- Keys match lib/surfboard-sell-categories.ts SURFBOARD_SELL_CATEGORY_ORDER.
ALTER TABLE public.brand_models
  ADD COLUMN IF NOT EXISTS board_category_slug text
  CHECK (
    board_category_slug IS NULL
    OR board_category_slug IN (
      'shortboard', 'groveler', 'fish', 'asym', 'hybrid', 'longboard', 'step-up-gun', 'other'
    )
  );

COMMENT ON COLUMN public.brand_models.board_category_slug IS
  'Surfboard shape key (/sell board category chips); null for non-surfboard models or untagged boards.';
