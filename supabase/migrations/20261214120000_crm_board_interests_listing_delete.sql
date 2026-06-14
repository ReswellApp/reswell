-- When a listing is deleted, crm_board_interests.listing_id is SET NULL via FK.
-- That violates crm_board_interests_listing_required (interest_type = 'listing' requires listing_id).
-- Reclassify listing interests to custom before the delete so CRM history is preserved.

CREATE OR REPLACE FUNCTION public.crm_board_interests_on_listing_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_label text;
BEGIN
  listing_label := COALESCE(
    NULLIF(trim(concat_ws(' · ', OLD.brand, OLD.model, OLD.dimensions)), ''),
    NULLIF(trim(OLD.title), ''),
    'Deleted listing'
  );

  UPDATE public.crm_board_interests
  SET
    interest_type = 'custom',
    custom_description = listing_label || ' (listing removed)',
    brand = COALESCE(brand, OLD.brand),
    model = COALESCE(model, OLD.model),
    dimensions = COALESCE(dimensions, OLD.dimensions),
    listing_id = NULL,
    updated_at = now()
  WHERE listing_id = OLD.id
    AND interest_type = 'listing';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS crm_board_interests_reclassify_on_listing_delete ON public.listings;
CREATE TRIGGER crm_board_interests_reclassify_on_listing_delete
  BEFORE DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_board_interests_on_listing_delete();

COMMENT ON FUNCTION public.crm_board_interests_on_listing_delete() IS
  'Before listing delete: convert CRM listing interests to custom so FK SET NULL does not violate crm_board_interests_listing_required.';
