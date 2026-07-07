-- Comprehensive surfboard browse filter backfill for `/boards` sidebar facets.
--
-- Columns touched (see lib/boards-browse-facets.ts):
--   board_type          — Board Style
--   condition           — Condition (vocab already migrated elsewhere; included for completeness)
--   fins_setup          — Fin Setup
--   fin_system          — Fin System
--   construction        — Board Construction
--   length_total_inches — Length buckets
--   volume_liters       — Volume buckets
--
-- Idempotent: only fills NULL facet columns or normalizes legacy vocab (board_type, fins_setup,
-- condition). Safe to re-run after deploy.

-- ---------------------------------------------------------------------------
-- 1) Board Style — canonical board_type slugs for style filter + nav `type=`.
-- ---------------------------------------------------------------------------
UPDATE public.listings
SET board_type = 'hybrid'
WHERE section = 'surfboards'
  AND board_type IN ('funboard', 'mid-length');

UPDATE public.listings
SET board_type = 'step-up-gun'
WHERE section = 'surfboards'
  AND board_type IN ('step-up', 'gun');

-- Fish is a distinct surfboard shape again (see 20260703120000_surfboard_category_fish.sql);
-- do not fold `board_type = 'fish'` into groveler here.

-- ---------------------------------------------------------------------------
-- 2) Condition — sell-flow vocabulary (matches listingConditionFilterRows).
-- ---------------------------------------------------------------------------
UPDATE public.listings
SET condition = 'brand_new'
WHERE section = 'surfboards'
  AND condition = 'new';

UPDATE public.listings
SET condition = 'excellent'
WHERE section = 'surfboards'
  AND condition = 'like_new';

-- ---------------------------------------------------------------------------
-- 3) Fin Setup — normalize legacy layout slugs on listings.fins_setup.
--    Mirrors brand_model_variants fin_boxes remap (20261106120000_…).
-- ---------------------------------------------------------------------------
UPDATE public.listings
SET fins_setup = 'five'
WHERE section = 'surfboards'
  AND lower(trim(fins_setup)) = 'five_fin';

UPDATE public.listings
SET fins_setup = 'single'
WHERE section = 'surfboards'
  AND lower(trim(fins_setup)) = 'single_fin';

UPDATE public.listings
SET fins_setup = 'twin'
WHERE section = 'surfboards'
  AND lower(trim(fins_setup)) = 'two_plus_one';

UPDATE public.listings
SET fins_setup = 'other'
WHERE section = 'surfboards'
  AND lower(trim(fins_setup)) = 'twinzer';

UPDATE public.listings
SET fins_setup = replace(fins_setup, 'five_fin', 'five')
WHERE section = 'surfboards'
  AND fins_setup ILIKE '%five_fin%';

UPDATE public.listings
SET fins_setup = replace(fins_setup, 'single_fin', 'single')
WHERE section = 'surfboards'
  AND fins_setup ILIKE '%single_fin%';

UPDATE public.listings
SET fins_setup = replace(fins_setup, 'two_plus_one', 'twin')
WHERE section = 'surfboards'
  AND fins_setup ILIKE '%two_plus_one%';

UPDATE public.listings
SET fins_setup = replace(fins_setup, 'twinzer', 'other')
WHERE section = 'surfboards'
  AND fins_setup ILIKE '%twinzer%';

-- ---------------------------------------------------------------------------
-- 4) Length — length_total_inches from dimensions text, title token, and (legacy)
--    numeric columns when still present on older databases.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'length_feet'
  ) THEN
    EXECUTE $sql$
      UPDATE public.listings l
      SET length_total_inches = sub.total
      FROM (
        SELECT
          id,
          (length_feet::numeric * 12 + COALESCE(length_inches, 0)::numeric) AS total
        FROM public.listings
        WHERE section = 'surfboards'
          AND length_total_inches IS NULL
          AND length_feet IS NOT NULL
          AND length_feet >= 1
          AND length_feet <= 15
          AND COALESCE(length_inches, 0) >= 0
          AND COALESCE(length_inches, 0) < 12
      ) sub
      WHERE l.id = sub.id
        AND l.length_total_inches IS NULL
        AND sub.total > 0
        AND sub.total < 240;
    $sql$;
  END IF;
END $$;

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

-- Title prefix (e.g. "5'7 Hayden Shapes …") when structured fields are missing.
UPDATE public.listings l
SET length_total_inches = sub.total
FROM (
  SELECT
    id,
    (m[1])::numeric * 12 + COALESCE(NULLIF(m[2], '')::numeric, 0) AS total
  FROM (
    SELECT id, regexp_match(trim(title), '^(\d{1,2})''\s*(\d{1,2})?') AS m
    FROM public.listings
    WHERE section = 'surfboards'
      AND title IS NOT NULL
      AND trim(title) ~ '^\d{1,2}''\s*\d'
  ) r
  WHERE r.m IS NOT NULL AND r.m[1] IS NOT NULL
) sub
WHERE l.id = sub.id
  AND l.length_total_inches IS NULL
  AND sub.total > 0
  AND sub.total < 240;

-- ---------------------------------------------------------------------------
-- 5) Volume — volume_liters from dimensions, title, and legacy columns when present.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'volume'
  ) THEN
    EXECUTE $sql$
      UPDATE public.listings l
      SET volume_liters = l.volume::numeric
      WHERE l.section = 'surfboards'
        AND l.volume_liters IS NULL
        AND l.volume IS NOT NULL
        AND l.volume::numeric > 0
        AND l.volume::numeric < 200;
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'volume_display'
  ) THEN
    EXECUTE $sql$
      UPDATE public.listings l
      SET volume_liters = (sub.m[1])::numeric
      FROM (
        SELECT id, regexp_match(trim(volume_display), '([\d.]+)') AS m
        FROM public.listings
        WHERE section = 'surfboards'
          AND volume_display IS NOT NULL
          AND trim(volume_display) <> ''
      ) sub
      WHERE l.id = sub.id
        AND l.volume_liters IS NULL
        AND sub.m IS NOT NULL
        AND (sub.m[1])::numeric > 0
        AND (sub.m[1])::numeric < 200;
    $sql$;
  END IF;
END $$;

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

UPDATE public.listings l
SET volume_liters = (sub.m[1])::numeric
FROM (
  SELECT id, regexp_match(title, '(\d+(?:\.\d+)?)\s*[lL]\b') AS m
  FROM public.listings
  WHERE section = 'surfboards'
    AND title IS NOT NULL
    AND title ~ '\d+(?:\.\d+)?\s*[lL]\b'
) sub
WHERE l.id = sub.id
  AND l.volume_liters IS NULL
  AND sub.m IS NOT NULL
  AND (sub.m[1])::numeric > 0
  AND (sub.m[1])::numeric < 200;

-- ---------------------------------------------------------------------------
-- 6) Fin System + Construction — catalog backfill + fins_setup inference.
--    Re-runs pro-filter catalog logic with the aligned variant vocabulary.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brand_model_variants'
      AND column_name = 'material'
  ) THEN
    WITH model_material AS (
      SELECT
        brand_model_id,
        CASE WHEN count(DISTINCT material) = 1 THEN min(material) END AS mat
      FROM public.brand_model_variants
      GROUP BY brand_model_id
    )
    UPDATE public.listings l
    SET construction = CASE mm.mat
      WHEN 'eps' THEN 'eps_epoxy'
      WHEN 'pu' THEN 'pu_poly'
      WHEN 'eps_epoxy' THEN 'eps_epoxy'
      WHEN 'pu_poly' THEN 'pu_poly'
      WHEN 'carbon' THEN 'carbon'
      WHEN 'other' THEN 'other'
    END
    FROM model_material mm
    WHERE l.brand_model_id = mm.brand_model_id
      AND mm.mat IS NOT NULL
      AND l.construction IS NULL
      AND l.section = 'surfboards';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brand_model_variants'
      AND column_name = 'fin_box_type'
  ) THEN
    WITH model_fin AS (
      SELECT
        brand_model_id,
        CASE WHEN count(DISTINCT fin_box_type) = 1 THEN min(fin_box_type::text) END AS box
      FROM public.brand_model_variants
      GROUP BY brand_model_id
    )
    UPDATE public.listings l
    SET fin_system = CASE mf.box
      WHEN 'futures' THEN 'futures'
      WHEN 'fcs' THEN 'fcs_ii'
      WHEN 'fcs_ii' THEN 'fcs_ii'
      WHEN 'fcs_twin_tab' THEN 'fcs_twin_tab'
      WHEN 'single_fin' THEN 'single'
      WHEN 'single' THEN 'single'
      WHEN 'two_plus_one_futures' THEN 'two_plus_one_futures'
      WHEN 'two_plus_one_fcs' THEN 'two_plus_one_fcs'
      WHEN 'glass_on' THEN 'glass_on'
      WHEN 'other' THEN 'other'
    END
    FROM model_fin mf
    WHERE l.brand_model_id = mf.brand_model_id
      AND mf.box IS NOT NULL
      AND l.fin_system IS NULL
      AND l.section = 'surfboards';
  END IF;
END $$;

-- Best-effort fin_system from normalized fins_setup when catalog did not resolve it.
UPDATE public.listings
SET fin_system = 'fcs_ii'
WHERE section = 'surfboards'
  AND fin_system IS NULL
  AND fins_setup ILIKE '%fcs%';

UPDATE public.listings
SET fin_system = 'single'
WHERE section = 'surfboards'
  AND fin_system IS NULL
  AND (
    lower(trim(fins_setup)) = 'single'
    OR fins_setup ILIKE 'single,%'
    OR fins_setup ILIKE '%,single'
    OR fins_setup ILIKE '%,single,%'
  );

UPDATE public.listings
SET fin_system = 'glass_on'
WHERE section = 'surfboards'
  AND fin_system IS NULL
  AND (
    description ILIKE '%glass on%'
    OR description ILIKE '%glass-on%'
    OR title ILIKE '%glass on%'
  );
