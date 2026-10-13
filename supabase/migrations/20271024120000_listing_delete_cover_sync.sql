-- Cover columns exist so browse never joins listing_images. One statement
-- recomputes them from the live gallery for every listing that statement
-- touched. A listing delete records its id first; cover sync will not write
-- that row, because the delete already owns it (SQLSTATE 27000).
--
-- The skip rows last until the transaction commits, then a deferred trigger
-- removes them. Photo inserts and updates never consult a trigger-depth hack
-- and never open a subtransaction.

CREATE TABLE IF NOT EXISTS public.listing_cover_sync_skip (
  xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  listing_id uuid NOT NULL,
  PRIMARY KEY (xid, listing_id)
);

COMMENT ON TABLE public.listing_cover_sync_skip IS
  'Listing ids this transaction is already deleting. Cover sync must not update those rows. Cleared at commit.';

ALTER TABLE public.listing_cover_sync_skip ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.listing_cover_sync_skip FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.listings_note_cover_sync_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.listing_cover_sync_skip (listing_id)
  VALUES (OLD.id)
  ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.listings_clear_cover_sync_skip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.listing_cover_sync_skip
  WHERE xid = pg_current_xact_id()
    AND listing_id = OLD.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS listings_note_cover_sync_skip ON public.listings;
CREATE TRIGGER listings_note_cover_sync_skip
  BEFORE DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_note_cover_sync_skip();

DROP TRIGGER IF EXISTS listings_clear_cover_sync_skip ON public.listings;
CREATE CONSTRAINT TRIGGER listings_clear_cover_sync_skip
  AFTER DELETE ON public.listings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_clear_cover_sync_skip();

-- Same cover rule the row trigger used: first image by primary, sort, created
-- time; gallery is the first 12 images that actually have a URL.
CREATE OR REPLACE FUNCTION public.sync_listing_covers(p_listing_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_listing_ids IS NULL OR cardinality(p_listing_ids) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.listings AS listing
  SET
    primary_image_url = cover.url,
    primary_thumbnail_url = cover.thumbnail_url,
    tile_gallery_images = COALESCE(gallery.images, '[]'::jsonb)
  FROM (
    SELECT DISTINCT requested.listing_id
    FROM unnest(p_listing_ids) AS requested(listing_id)
    WHERE requested.listing_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.listing_cover_sync_skip AS skip
        WHERE skip.xid = pg_current_xact_id()
          AND skip.listing_id = requested.listing_id
      )
  ) AS ids
  LEFT JOIN LATERAL (
    SELECT image.url, image.thumbnail_url
    FROM public.listing_images AS image
    WHERE image.listing_id = ids.listing_id
    ORDER BY
      image.is_primary DESC NULLS LAST,
      image.sort_order ASC NULLS LAST,
      image.created_at ASC NULLS LAST
    LIMIT 1
  ) AS cover ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'url', ranked.url,
          'thumbnail_url', ranked.thumbnail_url
        )
        ORDER BY ranked.ord
      ),
      '[]'::jsonb
    ) AS images
    FROM (
      SELECT
        image.url,
        image.thumbnail_url,
        row_number() OVER (
          ORDER BY
            image.is_primary DESC NULLS LAST,
            image.sort_order ASC NULLS LAST,
            image.created_at ASC NULLS LAST
        ) AS ord
      FROM public.listing_images AS image
      WHERE image.listing_id = ids.listing_id
        AND image.url IS NOT NULL
        AND btrim(image.url) <> ''
    ) AS ranked
    WHERE ranked.ord <= 12
  ) AS gallery ON true
  WHERE listing.id = ids.listing_id
    AND (
      listing.primary_image_url IS DISTINCT FROM cover.url
      OR listing.primary_thumbnail_url IS DISTINCT FROM cover.thumbnail_url
      OR listing.tile_gallery_images IS DISTINCT FROM COALESCE(gallery.images, '[]'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.sync_listing_covers(uuid[]) IS
  'Recompute listing cover columns from listing_images. Skips ids registered by listings_note_cover_sync_skip.';

CREATE OR REPLACE FUNCTION public.listing_images_sync_cover_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_listing_covers(ARRAY(
    SELECT DISTINCT image_row.listing_id
    FROM new_rows AS image_row
    WHERE image_row.listing_id IS NOT NULL
  ));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_images_sync_cover_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_listing_covers(ARRAY(
    SELECT DISTINCT image_row.listing_id
    FROM old_rows AS image_row
    WHERE image_row.listing_id IS NOT NULL
  ));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_images_sync_cover_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_listing_covers(ARRAY(
    SELECT DISTINCT changed.listing_id
    FROM (
      SELECT image_row.listing_id FROM old_rows AS image_row
      UNION
      SELECT image_row.listing_id FROM new_rows AS image_row
    ) AS changed
    WHERE changed.listing_id IS NOT NULL
  ));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS listing_images_sync_listing_primary_image ON public.listing_images;
DROP FUNCTION IF EXISTS public.sync_listing_primary_image();

DROP TRIGGER IF EXISTS listing_images_sync_cover_insert ON public.listing_images;
CREATE TRIGGER listing_images_sync_cover_insert
  AFTER INSERT ON public.listing_images
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.listing_images_sync_cover_insert();

DROP TRIGGER IF EXISTS listing_images_sync_cover_delete ON public.listing_images;
CREATE TRIGGER listing_images_sync_cover_delete
  AFTER DELETE ON public.listing_images
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.listing_images_sync_cover_delete();

DROP TRIGGER IF EXISTS listing_images_sync_cover_update ON public.listing_images;
CREATE TRIGGER listing_images_sync_cover_update
  AFTER UPDATE OF url, thumbnail_url, is_primary, sort_order, listing_id
  ON public.listing_images
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.listing_images_sync_cover_update();
