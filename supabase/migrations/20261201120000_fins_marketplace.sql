-- Fins as a new marketplace product type.
--
-- Fins reuse the full surfboard commerce pipeline (cart, checkout, offers,
-- messaging, images, favorites, orders) by being rows in public.listings with
-- section = 'fins'. Fin attributes live on the single listings table: brand,
-- brand_id, model, brand_model_id, fins_setup, and fin_system already exist for
-- surfboards and are reused; fin_size is the only fin-specific column added.

BEGIN;

-- 1. Allow section = 'fins' on listings.
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_section_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_section_check CHECK (section IN ('new', 'surfboards', 'fins'));

-- 2. Fin size lives on listings (S/M/L/etc. slug). Setup -> fins_setup,
--    system -> fin_system, brand/model -> existing columns.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS fin_size text;

COMMENT ON COLUMN public.listings.fin_size IS
  'Fin size slug for section=fins listings: xs | s | m | l | xl | other. Null for non-fin listings.';

-- 3. listings.category_id is NOT NULL, so peer-to-peer fins need a dedicated
--    category. Fixed UUID matches USED_FINS_CATEGORY_ID in lib/fin-listing-config
--    (board = FALSE: fins are not a surfboard browse category). Distinct slug
--    from any retail 'new-fins' catalog category.
INSERT INTO public.categories (id, name, slug, description, board) VALUES
  (
    'f1115a1e-aaaa-4bbb-8ccc-000000000001',
    'Fins',
    'used-fins',
    'Used and pre-owned surfboard fins listed by surfers.',
    false
  )
ON CONFLICT (slug) DO NOTHING;

-- 4. Partial indexes to keep the /fins browse filters fast (section = 'fins').
CREATE INDEX IF NOT EXISTS listings_fins_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'fins';

CREATE INDEX IF NOT EXISTS listings_fins_setup_idx
  ON public.listings (fins_setup)
  WHERE section = 'fins' AND fins_setup IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_fins_system_idx
  ON public.listings (fin_system)
  WHERE section = 'fins' AND fin_system IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_fin_size_idx
  ON public.listings (fin_size)
  WHERE section = 'fins' AND fin_size IS NOT NULL;

COMMIT;
