-- Limit an admin-issued promo to marketplace product types (fins, surfboards, …).
-- NULL keeps the existing behavior: the percent applies to every item in the cart.

ALTER TABLE public.admin_issued_promo_codes
  ADD COLUMN IF NOT EXISTS eligible_sections text[];

ALTER TABLE public.admin_issued_promo_codes
  DROP CONSTRAINT IF EXISTS admin_issued_promo_codes_eligible_sections_valid;

ALTER TABLE public.admin_issued_promo_codes
  ADD CONSTRAINT admin_issued_promo_codes_eligible_sections_valid
  CHECK (
    eligible_sections IS NULL
    OR (
      cardinality(eligible_sections) BETWEEN 1 AND 10
      AND eligible_sections <@ ARRAY[
        'surfboards',
        'fins',
        'wetsuits',
        'boardbags',
        'surfpacks',
        'leashes',
        'apparel',
        'accessories',
        'magazines',
        'traction'
      ]::text[]
    )
  );

COMMENT ON COLUMN public.admin_issued_promo_codes.eligible_sections IS
  'Product types this code discounts. NULL discounts every item. Otherwise the percent applies only to checkout lines of these types (listings.section, or the Shopify reswell_section for shop inventory).';
