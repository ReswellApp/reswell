-- Cover columns on listings are a cache of listing_images for browse.
-- They only exist while the listing row exists.
--
-- A direct photo insert, update, or delete (trigger depth 1) must refresh that cache.
-- Deleting the listing cascades to listing_images. That nested delete must not
-- update the listing row: Postgres rejects it with triggered_data_change_violation
-- and the whole delete fails. The row is going away, so there is no cache to refresh.

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

  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
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

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.sync_listing_primary_image() IS
  'Refreshes listings cover columns from listing_images. Skips nested deletes, which are the listing ON DELETE CASCADE and have no cover row left to update.';
