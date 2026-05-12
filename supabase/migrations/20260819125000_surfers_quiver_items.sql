-- Replace flat URL list with structured quiver entries (image + optional title + description).

ALTER TABLE public.surfers
  ADD COLUMN IF NOT EXISTS quiver_items jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.surfers s
SET quiver_items = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object('image_url', trim(both from elem))
      ORDER BY ord
    )
    FROM unnest(COALESCE(s.quiver_image_urls, ARRAY[]::text[])) WITH ORDINALITY AS t(elem, ord)
    WHERE trim(both from elem) <> ''
  ),
  '[]'::jsonb
);

ALTER TABLE public.surfers DROP COLUMN IF EXISTS quiver_image_urls;
