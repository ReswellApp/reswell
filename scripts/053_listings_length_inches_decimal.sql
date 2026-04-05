-- Surfboard length_inches may be fractional (e.g. 11.875); the app UI allows decimal/fraction inches.
ALTER TABLE public.listings
  ALTER COLUMN length_inches TYPE NUMERIC(5, 2)
  USING length_inches::numeric;

COMMENT ON COLUMN public.listings.length_inches IS 'Inches portion of board length (0–11.99); may be fractional.';
