-- Draft autosave and publish can insert the same photo twice when the
-- client has not learned the row id yet. Collapse those copies, then reject
-- a second row with the same URL.

ALTER TABLE public.listing_images
  DISABLE TRIGGER guard_shopify_managed_listing_images_trigger;

DELETE FROM public.listing_images AS dup
WHERE dup.id IN (
  SELECT ranked.id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY listing_id, btrim(url)
        ORDER BY
          is_primary DESC NULLS LAST,
          sort_order ASC NULLS LAST,
          created_at ASC NULLS LAST,
          id ASC
      ) AS rn
    FROM public.listing_images
    WHERE url IS NOT NULL
      AND btrim(url) <> ''
  ) AS ranked
  WHERE ranked.rn > 1
);

ALTER TABLE public.listing_images
  ENABLE TRIGGER guard_shopify_managed_listing_images_trigger;

CREATE UNIQUE INDEX IF NOT EXISTS listing_images_listing_id_url_key
  ON public.listing_images (listing_id, url)
  WHERE url IS NOT NULL AND btrim(url) <> '';
