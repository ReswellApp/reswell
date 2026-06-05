-- New peer accessory types: wetsuits, boardbags, surfpacks, leashes, apparel, accessories.
--
-- Each new type is modeled on fins (see 20261201120000_fins_marketplace.sql): a
-- `listings` row with a dedicated `section` slug and a fixed peer-to-peer category.
-- Wetsuits ship with a size vocabulary now; the other five carry an (unused, NULL)
-- size column so the duplicated type code stays uniform — their size vocab/tags are
-- added later when provided.

BEGIN;

-- 1. Allow the six new sections on listings (drop + recreate the CHECK).
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_section_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_section_check CHECK (
    section IN (
      'new',
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories'
    )
  );

-- 2. Fixed peer-to-peer categories (board = FALSE). UUIDs must match the
--    USED_*_CATEGORY_ID constants in each lib/{type}-listing-config.ts.
INSERT INTO public.categories (id, name, slug, description, board) VALUES
  ('f1115a1e-aaaa-4bbb-8ccc-000000000002', 'Wetsuits', 'used-wetsuits', 'Used and pre-owned wetsuits listed by surfers.', false),
  ('f1115a1e-aaaa-4bbb-8ccc-000000000003', 'Boardbags', 'used-boardbags', 'Used and pre-owned boardbags listed by surfers.', false),
  ('f1115a1e-aaaa-4bbb-8ccc-000000000004', 'Surfpacks', 'used-surfpacks', 'Used and pre-owned surfpacks listed by surfers.', false),
  ('f1115a1e-aaaa-4bbb-8ccc-000000000005', 'Leashes', 'used-leashes', 'Used and pre-owned leashes listed by surfers.', false),
  ('f1115a1e-aaaa-4bbb-8ccc-000000000006', 'Apparel', 'used-apparel', 'Used and pre-owned surf apparel listed by surfers.', false),
  ('f1115a1e-aaaa-4bbb-8ccc-000000000007', 'Accessories', 'used-accessories', 'Used and pre-owned surf accessories listed by surfers.', false)
ON CONFLICT (slug) DO NOTHING;

-- 3. Per-type size columns. Each lives on listings (slug strings). Only wetsuits
--    are populated for now; the rest are reserved (NULL) so the type code is uniform.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS wetsuit_size text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS boardbag_size text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS surfpack_size text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS leash_size text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS apparel_size text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS accessory_size text;

COMMENT ON COLUMN public.listings.wetsuit_size IS
  'Wetsuit size slug for section=wetsuits listings (xs | s | st | ms | m | mt | ls | l | lt | xls | xl | xlt | xxl). Null for other listings.';

-- 4. Browse indexes. Wetsuits get full filter indexes (created_at, condition, size);
--    the other five get a created_at index for the default browse sort.
CREATE INDEX IF NOT EXISTS listings_wetsuits_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'wetsuits';

CREATE INDEX IF NOT EXISTS listings_wetsuits_condition_idx
  ON public.listings (condition)
  WHERE section = 'wetsuits' AND condition IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_wetsuit_size_idx
  ON public.listings (wetsuit_size)
  WHERE section = 'wetsuits' AND wetsuit_size IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_boardbags_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'boardbags';

CREATE INDEX IF NOT EXISTS listings_surfpacks_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'surfpacks';

CREATE INDEX IF NOT EXISTS listings_leashes_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'leashes';

CREATE INDEX IF NOT EXISTS listings_apparel_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'apparel';

CREATE INDEX IF NOT EXISTS listings_accessories_section_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'accessories';

COMMIT;
