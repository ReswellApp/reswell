-- Cover columns can lag listing_images when parallel photo updates race the
-- row trigger. Rebuild primary_* and tile_gallery_images from the live gallery
-- (primary first, then sort_order) so browse tiles match the listing page.

UPDATE public.listings l
SET
  primary_image_url = cover.url,
  primary_thumbnail_url = cover.thumbnail_url,
  tile_gallery_images = gallery.images
FROM (
  SELECT DISTINCT ON (li.listing_id)
    li.listing_id,
    li.url,
    li.thumbnail_url
  FROM public.listing_images li
  WHERE li.url IS NOT NULL
    AND btrim(li.url) <> ''
  ORDER BY
    li.listing_id,
    li.is_primary DESC NULLS LAST,
    li.sort_order ASC NULLS LAST,
    li.created_at ASC NULLS LAST
) cover
JOIN (
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
    ) AS images
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
) gallery ON gallery.listing_id = cover.listing_id
WHERE l.id = cover.listing_id
  AND (
    l.primary_image_url IS DISTINCT FROM cover.url
    OR l.primary_thumbnail_url IS DISTINCT FROM cover.thumbnail_url
    OR l.tile_gallery_images IS DISTINCT FROM gallery.images
  );

UPDATE public.listings l
SET
  primary_image_url = NULL,
  primary_thumbnail_url = NULL,
  tile_gallery_images = '[]'::jsonb
WHERE (
  l.primary_image_url IS NOT NULL
  OR l.primary_thumbnail_url IS NOT NULL
  OR l.tile_gallery_images <> '[]'::jsonb
)
  AND NOT EXISTS (
    SELECT 1
    FROM public.listing_images li
    WHERE li.listing_id = l.id
      AND li.url IS NOT NULL
      AND btrim(li.url) <> ''
  );
