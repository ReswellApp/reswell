-- Slim user_listing_board_model_data: redundant or admin-only columns removed in favor of listings + label fields.

DROP INDEX IF EXISTS public.user_listing_board_model_data_pending_idx;

ALTER TABLE public.user_listing_board_model_data
  DROP COLUMN IF EXISTS listing_url,
  DROP COLUMN IF EXISTS dimensions,
  DROP COLUMN IF EXISTS fins_setup,
  DROP COLUMN IF EXISTS sold_at,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS dismissed_at,
  DROP COLUMN IF EXISTS admin_notes,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS category_id;

CREATE INDEX IF NOT EXISTS user_listing_board_model_data_pending_idx
  ON public.user_listing_board_model_data (listing_id)
  WHERE converted_brand_model_variant_id IS NULL;
