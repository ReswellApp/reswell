-- Idempotent cleanup: remove used-accessory columns from `public.listings`.
--
-- These columns were added by historical one-off scripts (e.g. scripts/017_*, 018, 019,
-- 020, 022, 024, 026) for the retired used-gear marketplace. The main migration
-- 20260407180000_surfboards_only_remove_used_gear.sql already drops them; this file
-- is safe to run afterward (no-op if gone) and helps if:
--   - an older database never received 20260407180000, or
--   - someone re-ran legacy scripts that re-added columns.
--
-- Surfboard-specific fields (board_type, fins_setup, tail_shape, length_*, etc.) stay.

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
