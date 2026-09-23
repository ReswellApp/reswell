-- Circulating surfboard archive.
-- One row per published surfboard listing that is tagged with a directory brand and model.
-- brand_models / brand_model_variants stay the shape catalog. This table is the boards
-- that actually move through Reswell, kept so a later image match can compare a new
-- listing photo against boards we have already seen.
--
-- Variant matching mirrors lib/services/boardArchiveVariantMatch.ts:
-- store a variant id only when length and volume (whichever the listing has) identify
-- exactly one surfboard size, then narrow by fin system and fin setup when that still
-- leaves more than one row.

CREATE OR REPLACE FUNCTION public.board_archive_length_inches(label text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  m text[];
  feet numeric;
  inches numeric;
  denominator numeric;
BEGIN
  IF label IS NULL OR btrim(label) = '' THEN
    RETURN NULL;
  END IF;

  -- POSIX classes so this does not depend on ARE escapes (\d, \s, (?:)).
  -- Groups: 1 feet, 2 inches, 3 decimal tail, 4 fraction chunk, 5 numerator, 6 denominator.
  m := regexp_match(
    label,
    '([0-9]+)[[:space:]]*[''′’][[:space:]]*([0-9]+(\.[0-9]+)?)?([[:space:]]+([0-9]+)[[:space:]]*/[[:space:]]*([0-9]+))?'
  );
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  feet := m[1]::numeric;
  inches := COALESCE(m[2]::numeric, 0);
  IF m[5] IS NOT NULL AND m[6] IS NOT NULL THEN
    denominator := m[6]::numeric;
    IF denominator = 0 THEN
      RETURN NULL;
    END IF;
    inches := inches + (m[5]::numeric / denominator);
  END IF;

  IF feet < 1 OR feet > 15 OR inches < 0 OR inches >= 12 THEN
    RETURN NULL;
  END IF;

  RETURN feet * 12 + inches;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_archive_volume_liters(label text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN label IS NULL OR btrim(label) = '' THEN NULL::numeric
    ELSE substring(lower(label) from '([0-9]+(\.[0-9]+)?)')::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.board_archive_match_variant(
  p_brand_model_id uuid,
  p_length_total_inches numeric,
  p_volume_liters numeric,
  p_fin_system text,
  p_fins_setup text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_length_total_inches IS NULL AND p_volume_liters IS NULL THEN
    RETURN NULL;
  END IF;

  WITH parsed AS (
    SELECT
      v.id,
      public.board_archive_length_inches(v.length_label) AS len_in,
      public.board_archive_volume_liters(v.volume_label) AS vol_l,
      v.fin_box_type,
      v.fin_boxes
    FROM public.brand_model_variants v
    WHERE v.brand_model_id = p_brand_model_id
      AND v.product_category_slug = 'surfboards'
  ),
  dim AS (
    SELECT *
    FROM parsed
    WHERE (
        p_length_total_inches IS NULL
        OR (
          len_in IS NOT NULL
          AND abs(len_in - p_length_total_inches) <= 0.6
        )
      )
      AND (
        p_volume_liters IS NULL
        OR (
          vol_l IS NOT NULL
          AND abs(vol_l - p_volume_liters) <= 0.15
        )
      )
  ),
  fin AS (
    SELECT d.*
    FROM dim d
    WHERE p_fin_system IS NULL
      OR d.fin_box_type = p_fin_system
      OR NOT EXISTS (
        SELECT 1 FROM dim d2 WHERE d2.fin_box_type = p_fin_system
      )
  ),
  setup AS (
    SELECT f.*
    FROM fin f
    WHERE p_fins_setup IS NULL
      OR f.fin_boxes = p_fins_setup
      OR NOT EXISTS (
        SELECT 1 FROM fin f2 WHERE f2.fin_boxes = p_fins_setup
      )
  )
  SELECT CASE
    WHEN count(*) = 1 THEN (array_agg(id))[1]
    ELSE NULL
  END
  INTO v_id
  FROM setup;

  RETURN v_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.board_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  brand_model_id uuid NOT NULL REFERENCES public.brand_models (id) ON DELETE CASCADE,
  brand_model_variant_id uuid REFERENCES public.brand_model_variants (id) ON DELETE SET NULL,
  listing_image_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_archive_brand_id_idx
  ON public.board_archive (brand_id);

CREATE INDEX IF NOT EXISTS board_archive_brand_model_id_idx
  ON public.board_archive (brand_model_id);

CREATE INDEX IF NOT EXISTS board_archive_brand_model_variant_id_idx
  ON public.board_archive (brand_model_variant_id)
  WHERE brand_model_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS board_archive_created_at_idx
  ON public.board_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS board_archive_listing_image_ids_idx
  ON public.board_archive USING gin (listing_image_ids);

COMMENT ON TABLE public.board_archive IS
  'Surfboards that have circulated on Reswell: one row per published listing tagged with a directory brand and model, plus every listing photo id and the catalog size when measurements identify one variant.';

COMMENT ON COLUMN public.board_archive.listing_id IS
  'Marketplace listing for this physical board appearance.';

COMMENT ON COLUMN public.board_archive.brand_model_variant_id IS
  'Catalog size when listing length/volume uniquely match one brand_model_variants row. Null when the size is unknown or ambiguous.';

COMMENT ON COLUMN public.board_archive.listing_image_ids IS
  'Every listing_images id for this listing, primary first, then sort order. Files live on listing_images.';

DROP TRIGGER IF EXISTS board_archive_set_updated_at ON public.board_archive;
CREATE TRIGGER board_archive_set_updated_at
  BEFORE UPDATE ON public.board_archive
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_board_archive(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l record;
  v_variant uuid;
  v_image_ids uuid[];
BEGIN
  SELECT
    id,
    section,
    status,
    title,
    brand_id,
    brand_model_id,
    length_total_inches,
    volume_liters,
    fin_system,
    fins_setup
  INTO l
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND
    OR l.section IS DISTINCT FROM 'surfboards'
    OR l.brand_id IS NULL
    OR l.brand_model_id IS NULL
    OR l.status NOT IN ('active', 'sold', 'pending', 'pending_sale')
    OR btrim(COALESCE(l.title, '')) ~* '^admin seed'
    OR NOT EXISTS (
      SELECT 1 FROM public.brand_models bm WHERE bm.id = l.brand_model_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.brands b WHERE b.id = l.brand_id
    )
  THEN
    DELETE FROM public.board_archive WHERE listing_id = p_listing_id;
    RETURN;
  END IF;

  v_variant := public.board_archive_match_variant(
    l.brand_model_id,
    l.length_total_inches,
    l.volume_liters,
    NULLIF(btrim(COALESCE(l.fin_system, '')), ''),
    NULLIF(btrim(COALESCE(l.fins_setup, '')), '')
  );

  SELECT COALESCE(
    array_agg(
      li.id
      ORDER BY li.is_primary DESC NULLS LAST, li.sort_order ASC NULLS LAST, li.created_at ASC
    ),
    '{}'::uuid[]
  )
  INTO v_image_ids
  FROM public.listing_images li
  WHERE li.listing_id = p_listing_id;

  INSERT INTO public.board_archive (
    listing_id,
    brand_id,
    brand_model_id,
    brand_model_variant_id,
    listing_image_ids
  )
  VALUES (
    l.id,
    l.brand_id,
    l.brand_model_id,
    v_variant,
    v_image_ids
  )
  ON CONFLICT (listing_id) DO UPDATE
  SET
    brand_id = EXCLUDED.brand_id,
    brand_model_id = EXCLUDED.brand_model_id,
    brand_model_variant_id = EXCLUDED.brand_model_variant_id,
    listing_image_ids = EXCLUDED.listing_image_ids,
    updated_at = now()
  WHERE board_archive.brand_id IS DISTINCT FROM EXCLUDED.brand_id
    OR board_archive.brand_model_id IS DISTINCT FROM EXCLUDED.brand_model_id
    OR board_archive.brand_model_variant_id IS DISTINCT FROM EXCLUDED.brand_model_variant_id
    OR board_archive.listing_image_ids IS DISTINCT FROM EXCLUDED.listing_image_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_archive_on_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status = 'draft'
    AND NEW.status = 'draft'
    AND OLD.section IS NOT DISTINCT FROM NEW.section
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.brand_id IS NOT DISTINCT FROM OLD.brand_id
    AND NEW.brand_model_id IS NOT DISTINCT FROM OLD.brand_model_id
    AND NEW.section IS NOT DISTINCT FROM OLD.section
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.dimensions IS NOT DISTINCT FROM OLD.dimensions
    AND NEW.length_total_inches IS NOT DISTINCT FROM OLD.length_total_inches
    AND NEW.volume_liters IS NOT DISTINCT FROM OLD.volume_liters
    AND NEW.fin_system IS NOT DISTINCT FROM OLD.fin_system
    AND NEW.fins_setup IS NOT DISTINCT FROM OLD.fins_setup
    AND NEW.title IS NOT DISTINCT FROM OLD.title
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.refresh_board_archive(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'board_archive listing sync failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_archive_on_listing_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);
  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM public.refresh_board_archive(v_listing_id);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'board_archive image sync failed for listing %: %', v_listing_id, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_board_archive_on_listing ON public.listings;
CREATE TRIGGER trg_board_archive_on_listing
  AFTER INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.board_archive_on_listing();

DROP TRIGGER IF EXISTS trg_board_archive_on_listing_image ON public.listing_images;
CREATE TRIGGER trg_board_archive_on_listing_image
  AFTER INSERT OR UPDATE OR DELETE ON public.listing_images
  FOR EACH ROW
  EXECUTE FUNCTION public.board_archive_on_listing_image();

ALTER TABLE public.board_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_archive_select_admin" ON public.board_archive;
CREATE POLICY "board_archive_select_admin"
  ON public.board_archive
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

REVOKE ALL ON FUNCTION public.board_archive_length_inches(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.board_archive_volume_liters(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.board_archive_match_variant(uuid, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_board_archive(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.board_archive_on_listing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.board_archive_on_listing_image() FROM PUBLIC, anon, authenticated;

-- Existing published surfboards already tagged with a brand and model.
INSERT INTO public.board_archive (
  listing_id,
  brand_id,
  brand_model_id,
  brand_model_variant_id,
  listing_image_ids
)
SELECT
  l.id,
  l.brand_id,
  l.brand_model_id,
  public.board_archive_match_variant(
    l.brand_model_id,
    l.length_total_inches,
    l.volume_liters,
    NULLIF(btrim(COALESCE(l.fin_system, '')), ''),
    NULLIF(btrim(COALESCE(l.fins_setup, '')), '')
  ),
  img.ids
FROM public.listings l
JOIN public.brands b ON b.id = l.brand_id
JOIN public.brand_models bm ON bm.id = l.brand_model_id
LEFT JOIN LATERAL (
  SELECT COALESCE(
    array_agg(
      li.id
      ORDER BY li.is_primary DESC NULLS LAST, li.sort_order ASC NULLS LAST, li.created_at ASC
    ),
    '{}'::uuid[]
  ) AS ids
  FROM public.listing_images li
  WHERE li.listing_id = l.id
) img ON true
WHERE l.section = 'surfboards'
  AND l.status IN ('active', 'sold', 'pending', 'pending_sale')
  AND btrim(COALESCE(l.title, '')) !~* '^admin seed';
