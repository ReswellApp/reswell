-- Pro surfboard browse filters: structured, indexable facet columns on listings.
--   length_total_inches : overall board length in inches (feet*12 + whole inches) for range buckets
--   volume_liters       : board volume in liters for range buckets
--   fin_system          : plug/box system (Futures, FCS II, single tab, 2+1, glass-on, …)
--   construction        : blank/lamination (EPS/Epoxy, PU/Poly, Carbon, …)
--
-- length_total_inches / volume_liters are backfilled (best-effort) by parsing the canonical
-- `listings.dimensions` text `(L'I W T VL)`. Going forward the sell flow writes them directly.
-- fin_system / construction are backfilled from `brand_model_variants` only when every variant
-- of the linked model agrees (unambiguous); otherwise left null for the seller to set.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS length_total_inches numeric,
  ADD COLUMN IF NOT EXISTS volume_liters numeric,
  ADD COLUMN IF NOT EXISTS fin_system text,
  ADD COLUMN IF NOT EXISTS construction text;

COMMENT ON COLUMN public.listings.length_total_inches IS
  'Overall board length in inches (feet*12 + whole inches); powers length range filters.';
COMMENT ON COLUMN public.listings.volume_liters IS
  'Board volume in liters; powers volume range filters.';
COMMENT ON COLUMN public.listings.fin_system IS
  'Fin plug/box system slug: futures | fcs_ii | fcs_twin_tab | single | two_plus_one_futures | two_plus_one_fcs | glass_on | other.';
COMMENT ON COLUMN public.listings.construction IS
  'Blank/lamination slug: eps_epoxy | pu_poly | carbon | other.';

-- Best-effort length backfill: feet + whole inches from the dimensions string (fractional
-- inches are ignored — irrelevant for 6-inch range buckets).
UPDATE public.listings l
SET length_total_inches = sub.total
FROM (
  SELECT id, (m[1])::numeric * 12 + COALESCE(NULLIF(m[2], '')::numeric, 0) AS total
  FROM (
    SELECT id, regexp_match(dimensions, '(\d+)''\s*(\d*)') AS m
    FROM public.listings
    WHERE section = 'surfboards' AND dimensions IS NOT NULL
  ) r
  WHERE r.m IS NOT NULL AND r.m[1] IS NOT NULL
) sub
WHERE l.id = sub.id
  AND l.length_total_inches IS NULL
  AND sub.total > 0
  AND sub.total < 240;

-- Best-effort volume backfill: number immediately before the trailing `L`.
UPDATE public.listings l
SET volume_liters = (sub.m[1])::numeric
FROM (
  SELECT id, regexp_match(dimensions, '([0-9]+(?:\.[0-9]+)?)\s*[lL]\)?\s*$') AS m
  FROM public.listings
  WHERE section = 'surfboards' AND dimensions IS NOT NULL
) sub
WHERE l.id = sub.id
  AND l.volume_liters IS NULL
  AND sub.m IS NOT NULL
  AND (sub.m[1])::numeric > 0
  AND (sub.m[1])::numeric < 200;

-- Construction backfill from catalog (only when every variant of the model agrees).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brand_model_variants' AND column_name = 'material'
  ) THEN
    WITH model_material AS (
      SELECT brand_model_id,
        CASE WHEN count(DISTINCT material) = 1 THEN min(material) END AS mat
      FROM public.brand_model_variants
      GROUP BY brand_model_id
    )
    UPDATE public.listings l
    SET construction = CASE mm.mat WHEN 'eps' THEN 'eps_epoxy' WHEN 'pu' THEN 'pu_poly' END
    FROM model_material mm
    WHERE l.brand_model_id = mm.brand_model_id
      AND mm.mat IS NOT NULL
      AND l.construction IS NULL
      AND l.section = 'surfboards';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brand_model_variants' AND column_name = 'fin_box_type'
  ) THEN
    WITH model_fin AS (
      SELECT brand_model_id,
        CASE WHEN count(DISTINCT fin_box_type) = 1 THEN min(fin_box_type::text) END AS box
      FROM public.brand_model_variants
      GROUP BY brand_model_id
    )
    UPDATE public.listings l
    SET fin_system = CASE mf.box
      WHEN 'futures' THEN 'futures'
      WHEN 'fcs' THEN 'fcs_ii'
      WHEN 'single_fin' THEN 'single'
    END
    FROM model_fin mf
    WHERE l.brand_model_id = mf.brand_model_id
      AND mf.box IS NOT NULL
      AND l.fin_system IS NULL
      AND l.section = 'surfboards';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_length_total_inches_idx
  ON public.listings (length_total_inches)
  WHERE section = 'surfboards';
CREATE INDEX IF NOT EXISTS listings_volume_liters_idx
  ON public.listings (volume_liters)
  WHERE section = 'surfboards';
CREATE INDEX IF NOT EXISTS listings_fin_system_idx
  ON public.listings (fin_system)
  WHERE section = 'surfboards';
CREATE INDEX IF NOT EXISTS listings_construction_idx
  ON public.listings (construction)
  WHERE section = 'surfboards';
