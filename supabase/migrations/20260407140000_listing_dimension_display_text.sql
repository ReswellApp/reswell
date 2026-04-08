-- Preserve seller-entered dimension text (fractions or decimals) for listing detail display.
-- Numeric columns (length_inches, width, etc.) remain for validation and future use.
--
-- Run this once on your Supabase project (SQL Editor or `supabase db push`).
-- Until these columns exist, avoid selecting them by name in the app; the sell edit flow
-- uses `select *` and does not PATCH these fields from the client until you wire them back in.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS length_inches_display text,
  ADD COLUMN IF NOT EXISTS width_inches_display text,
  ADD COLUMN IF NOT EXISTS thickness_inches_display text,
  ADD COLUMN IF NOT EXISTS volume_display text;

COMMENT ON COLUMN public.listings.length_inches_display IS 'Inches portion as entered on sell form (e.g. 2 1/4).';
COMMENT ON COLUMN public.listings.width_inches_display IS 'Width as entered (fractions or decimals).';
COMMENT ON COLUMN public.listings.thickness_inches_display IS 'Thickness as entered.';
COMMENT ON COLUMN public.listings.volume_display IS 'Volume as entered (e.g. 25.4 or 25 1/2).';
