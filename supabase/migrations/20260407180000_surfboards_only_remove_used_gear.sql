-- Surfboards-only marketplace: retire used-gear listings, categories, and listing columns.
-- Run after deploying app changes that no longer create section = 'used' rows.
--
-- Summary:
-- 1. Clear carts / reassign categories / migrate legacy rows off section "used"
-- 2. Drop gear-only categories and categories.gear
-- 3. Tighten listings.section to ('new', 'surfboards')
-- 4. Drop accessory-specific columns from listings

BEGIN;

-- Saved carts for listings we are retiring
DELETE FROM public.cart_items AS ci
USING public.listings AS l
WHERE ci.listing_id = l.id
  AND l.section = 'used';

-- Hide from browse (preserves FKs on orders, messages, etc.)
UPDATE public.listings
SET status = 'removed',
    updated_at = NOW()
WHERE section = 'used'
  AND status = 'active';

-- Point legacy rows at a real surfboard category so gear category rows can be deleted
DO $$
DECLARE
  fb UUID;
BEGIN
  SELECT c.id
  INTO fb
  FROM public.categories AS c
  WHERE c.board = TRUE
  ORDER BY c.slug
  LIMIT 1;

  IF fb IS NOT NULL THEN
    UPDATE public.listings AS l
    SET category_id = fb,
        updated_at = NOW()
    WHERE l.section = 'used';
  END IF;
END $$;

-- Normalize section so CHECK constraint no longer allows 'used'
UPDATE public.listings
SET section = 'surfboards',
    updated_at = NOW()
WHERE section = 'used';

DELETE FROM public.categories AS c WHERE c.gear = TRUE;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_board_xor_gear;

ALTER TABLE public.categories
  DROP COLUMN IF EXISTS gear;

COMMENT ON COLUMN public.categories.board IS
  'TRUE when this category is for surfboard marketplace listings (listings.section = surfboards). FALSE for retail catalog categories (section = new).';

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_section_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_section_check CHECK (section IN ('new', 'surfboards'));

-- Accessory / used-gear attributes (no longer used)
ALTER TABLE public.listings DROP COLUMN IF EXISTS gear_size;
ALTER TABLE public.listings DROP COLUMN IF EXISTS gear_color;
ALTER TABLE public.listings DROP COLUMN IF EXISTS pack_kind;
ALTER TABLE public.listings DROP COLUMN IF EXISTS board_bag_kind;
ALTER TABLE public.listings DROP COLUMN IF EXISTS apparel_kind;
ALTER TABLE public.listings DROP COLUMN IF EXISTS wetsuit_size;
ALTER TABLE public.listings DROP COLUMN IF EXISTS wetsuit_thickness;
ALTER TABLE public.listings DROP COLUMN IF EXISTS wetsuit_zip_type;
ALTER TABLE public.listings DROP COLUMN IF EXISTS leash_length;
ALTER TABLE public.listings DROP COLUMN IF EXISTS leash_thickness;
ALTER TABLE public.listings DROP COLUMN IF EXISTS collectible_type;
ALTER TABLE public.listings DROP COLUMN IF EXISTS collectible_era;
ALTER TABLE public.listings DROP COLUMN IF EXISTS collectible_condition;

COMMIT;
