-- Sell form + catalog use condition: brand_new, excellent, very_good, good, fair, poor
-- (see lib/listing-labels.ts, brand_model_variants_condition_check).
-- Legacy listings.condition allowed only new, like_new, good, fair — inserts failed with
-- listings_condition_check when sellers picked e.g. Brand New (brand_new).
--
-- Drop the old CHECK *before* UPDATEs: changing 'new' → 'brand_new' would otherwise violate
-- the legacy constraint mid-migration.

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_condition_check;

UPDATE public.listings SET condition = 'brand_new' WHERE condition = 'new';
UPDATE public.listings SET condition = 'excellent' WHERE condition = 'like_new';

ALTER TABLE public.listings
  ADD CONSTRAINT listings_condition_check CHECK (
    condition IN ('brand_new', 'excellent', 'very_good', 'good', 'fair', 'poor')
  );

COMMENT ON CONSTRAINT listings_condition_check ON public.listings IS
  'Sell-form vocabulary; aligns with public.brand_model_variants.condition.';
