-- /boards browse: admin-suppressed surfboards stay visible but sort last in the main grid.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS suppressed_on_boards_browse boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.suppressed_on_boards_browse IS
  'When true, listing sorts last in /boards browse (still visible unless hidden_from_site).';

CREATE INDEX IF NOT EXISTS listings_suppressed_on_boards_browse_idx
  ON public.listings (suppressed_on_boards_browse)
  WHERE section = 'surfboards' AND status = 'active';

-- Remove unused pin table if an earlier draft migration was applied locally.
DROP TABLE IF EXISTS public.boards_browse_bottom_listings;
