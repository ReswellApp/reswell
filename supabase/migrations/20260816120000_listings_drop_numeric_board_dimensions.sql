-- Surfboard dims are only `listings.dimensions`; remove redundant numeric columns.

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS length_feet,
  DROP COLUMN IF EXISTS length_inches,
  DROP COLUMN IF EXISTS width,
  DROP COLUMN IF EXISTS thickness,
  DROP COLUMN IF EXISTS volume;
