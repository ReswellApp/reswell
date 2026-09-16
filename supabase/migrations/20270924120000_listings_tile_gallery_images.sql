-- Denormalize a capped, primary-first gallery onto listings so card carousels
-- can page photos without a listing_images lateral join (same hot path as
-- primary_image_url). Synced by the existing listing_images trigger.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS tile_gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.listings.tile_gallery_images IS
  'Denormalized card-carousel photos: jsonb array of {url, thumbnail_url}, primary first, max 12. Synced from listing_images.';

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

UPDATE public.listings l
SET tile_gallery_images = s.gallery
FROM (
  SELECT
    ranked.listing_id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'url', ranked.url,
          'thumbnail_url', ranked.thumbnail_url
        )
        ORDER BY ranked.ord
      ),
      '[]'::jsonb
    ) AS gallery
  FROM (
    SELECT
      li.listing_id,
      li.url,
      li.thumbnail_url,
      row_number() OVER (
        PARTITION BY li.listing_id
        ORDER BY
          li.is_primary DESC NULLS LAST,
          li.sort_order ASC NULLS LAST,
          li.created_at ASC NULLS LAST
      ) AS ord
    FROM public.listing_images li
    WHERE li.url IS NOT NULL
      AND btrim(li.url) <> ''
  ) ranked
  WHERE ranked.ord <= 12
  GROUP BY ranked.listing_id
) s
WHERE l.id = s.listing_id
  AND l.tile_gallery_images IS DISTINCT FROM s.gallery;

UPDATE public.listings l
SET tile_gallery_images = '[]'::jsonb
WHERE l.tile_gallery_images <> '[]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM public.listing_images li WHERE li.listing_id = l.id
  );
