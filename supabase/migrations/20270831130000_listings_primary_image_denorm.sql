-- Denormalize primary card image onto listings so browse/home/seller grids
-- can avoid lateral joins into listing_images (pg_stat Aug 2026 hot path).
-- Kept in sync by trigger on listing_images; mirrors unread_message_count pattern.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS primary_image_url text,
  ADD COLUMN IF NOT EXISTS primary_thumbnail_url text;

COMMENT ON COLUMN public.listings.primary_image_url IS
  'Denormalized cover image URL for cards/browse. Synced from listing_images (is_primary, else lowest sort_order).';

COMMENT ON COLUMN public.listings.primary_thumbnail_url IS
  'Denormalized cover thumbnail URL for cards/browse. Synced from listing_images.thumbnail_url (may be null).';

CREATE OR REPLACE FUNCTION public.sync_listing_primary_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_url text;
  v_thumb text;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);
  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT li.url, li.thumbnail_url
  INTO v_url, v_thumb
  FROM public.listing_images li
  WHERE li.listing_id = v_listing_id
  ORDER BY
    li.is_primary DESC NULLS LAST,
    li.sort_order ASC NULLS LAST,
    li.created_at ASC NULLS LAST
  LIMIT 1;

  UPDATE public.listings
  SET
    primary_image_url = v_url,
    primary_thumbnail_url = v_thumb
  WHERE id = v_listing_id
    AND (
      primary_image_url IS DISTINCT FROM v_url
      OR primary_thumbnail_url IS DISTINCT FROM v_thumb
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS listing_images_sync_listing_primary_image ON public.listing_images;
CREATE TRIGGER listing_images_sync_listing_primary_image
  AFTER INSERT OR DELETE
  OR UPDATE OF url, thumbnail_url, is_primary, sort_order, listing_id
  ON public.listing_images
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_listing_primary_image();

-- One-shot backfill from current listing_images rows.
UPDATE public.listings l
SET
  primary_image_url = s.url,
  primary_thumbnail_url = s.thumbnail_url
FROM (
  SELECT DISTINCT ON (listing_id)
    listing_id,
    url,
    thumbnail_url
  FROM public.listing_images
  ORDER BY
    listing_id,
    is_primary DESC NULLS LAST,
    sort_order ASC NULLS LAST,
    created_at ASC NULLS LAST
) s
WHERE l.id = s.listing_id
  AND (
    l.primary_image_url IS DISTINCT FROM s.url
    OR l.primary_thumbnail_url IS DISTINCT FROM s.thumbnail_url
  );

-- Clear denorm when a listing has no images left.
UPDATE public.listings l
SET
  primary_image_url = NULL,
  primary_thumbnail_url = NULL
WHERE l.primary_image_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.listing_images li WHERE li.listing_id = l.id
  );
