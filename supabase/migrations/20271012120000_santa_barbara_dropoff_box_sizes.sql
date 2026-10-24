-- Santa Barbara drop-off cartons:
--   5'10" and under (any width) → 74×23×5 in, 16 lb
--   5'11" and up                 → 86×23×5 in, 18 lb
-- Rewrite packed parcels on listings that still use a previous Santa Barbara
-- catalog carton (76×22×5 or 84×22×5) or have no carton yet.

UPDATE public.dropoff_locations
SET box_rules = $rules$[
  {
    "id": "under-5-10",
    "label": "5'10\" and under",
    "minLengthIn": null,
    "maxLengthIn": 70,
    "maxWidthIn": null,
    "boxLengthIn": 74,
    "boxWidthIn": 23,
    "boxHeightIn": 5,
    "weightLb": 16
  },
  {
    "id": "5-11-and-up",
    "label": "5'11\" and up",
    "minLengthIn": 70.01,
    "maxLengthIn": 192,
    "maxWidthIn": null,
    "boxLengthIn": 86,
    "boxWidthIn": 23,
    "boxHeightIn": 5,
    "weightLb": 18
  }
]$rules$::jsonb
WHERE slug = 'santa-barbara';

WITH sized AS (
  SELECT
    l.id,
    COALESCE(
      l.length_total_inches,
      CASE
        WHEN regexp_match(l.dimensions, '(\d+)''\s*(\d+(?:\.\d+)?)') IS NOT NULL THEN
          (regexp_match(l.dimensions, '(\d+)''\s*(\d+(?:\.\d+)?)'))[1]::numeric * 12
          + COALESCE(
            NULLIF((regexp_match(l.dimensions, '(\d+)''\s*(\d+(?:\.\d+)?)'))[2], '')::numeric,
            0
          )
      END
    ) AS length_in
  FROM public.listings l
  JOIN public.dropoff_locations d ON d.id = l.dropoff_location_id
  WHERE d.slug = 'santa-barbara'
    AND (
      l.shipping_packed_length_in IS NULL
      OR (
        l.shipping_packed_length_in IN (76, 84)
        AND l.shipping_packed_width_in = 22
        AND l.shipping_packed_height_in = 5
      )
    )
)
UPDATE public.listings l
SET
  shipping_packed_length_in = CASE WHEN s.length_in <= 70 THEN 74 ELSE 86 END,
  shipping_packed_width_in = 23,
  shipping_packed_height_in = 5,
  shipping_packed_weight_oz = CASE WHEN s.length_in <= 70 THEN 256 ELSE 288 END,
  shipping_package_band = NULL
FROM sized s
WHERE l.id = s.id
  AND s.length_in IS NOT NULL
  AND s.length_in > 0;
