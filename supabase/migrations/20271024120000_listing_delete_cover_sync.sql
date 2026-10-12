-- Deleting a listing cascades to listing_images. sync_listing_primary_image()
-- then UPDATEs that same listings row to refresh primary_* and
-- tile_gallery_images. Postgres rejects the second write with SQLSTATE 27000
-- ("tuple to be updated was already modified by an operation triggered by
-- the current command") and the seller delete rolls back. The app shows
-- "Failed to delete listing".
--
-- A direct photo delete still refreshes the cover. Only the cascaded delete
-- of a listing that is already going away is ignored.

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
  v_gallery jsonb;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);
  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    s.url,
    s.thumbnail_url
  INTO v_url, v_thumb
  FROM (
    SELECT
      li.url,
      li.thumbnail_url
    FROM public.listing_images li
    WHERE li.listing_id = v_listing_id
    ORDER BY
      li.is_primary DESC NULLS LAST,
      li.sort_order ASC NULLS LAST,
      li.created_at ASC NULLS LAST
    LIMIT 1
  ) s;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'url', ranked.url,
        'thumbnail_url', ranked.thumbnail_url
      )
      ORDER BY ranked.ord
    ),
    '[]'::jsonb
  )
  INTO v_gallery
  FROM (
    SELECT
      li.url,
      li.thumbnail_url,
      row_number() OVER (
        ORDER BY
          li.is_primary DESC NULLS LAST,
          li.sort_order ASC NULLS LAST,
          li.created_at ASC NULLS LAST
      ) AS ord
    FROM public.listing_images li
    WHERE li.listing_id = v_listing_id
      AND li.url IS NOT NULL
      AND btrim(li.url) <> ''
  ) ranked
  WHERE ranked.ord <= 12;

  BEGIN
    UPDATE public.listings
    SET
      primary_image_url = v_url,
      primary_thumbnail_url = v_thumb,
      tile_gallery_images = COALESCE(v_gallery, '[]'::jsonb)
    WHERE id = v_listing_id
      AND (
        primary_image_url IS DISTINCT FROM v_url
        OR primary_thumbnail_url IS DISTINCT FROM v_thumb
        OR tile_gallery_images IS DISTINCT FROM COALESCE(v_gallery, '[]'::jsonb)
      );
  EXCEPTION
    WHEN SQLSTATE '27000' THEN
      -- Cascaded image deletes run while the listing row is already being
      -- removed. Cover columns disappear with that row, so ignore the conflict.
      -- Any other statement that hits this still fails.
      IF TG_OP IS DISTINCT FROM 'DELETE' THEN
        RAISE;
      END IF;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
