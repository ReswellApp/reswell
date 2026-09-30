BEGIN;

CREATE OR REPLACE FUNCTION public.boards_browse_geo_fallback(
  p_anchor_lat double precision,
  p_anchor_lng double precision,
  p_query text DEFAULT '',
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  fallback_kind text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH filter_values AS (
    SELECT
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'boardTypes', '[]'::jsonb))), ARRAY[]::text[]) AS board_types,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'categoryIds', '[]'::jsonb))), ARRAY[]::text[]) AS category_ids,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'styleTags', '[]'::jsonb))), ARRAY[]::text[]) AS style_tags,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'conditions', '[]'::jsonb))), ARRAY[]::text[]) AS conditions,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'finSystems', '[]'::jsonb))), ARRAY[]::text[]) AS fin_systems,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'constructions', '[]'::jsonb))), ARRAY[]::text[]) AS constructions,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'finSetups', '[]'::jsonb))), ARRAY[]::text[]) AS fin_setups,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'dimensionTokens', '[]'::jsonb))), ARRAY[]::text[]) AS dimension_tokens,
      coalesce(p_filters->'lengthRanges', '[]'::jsonb) AS length_ranges,
      coalesce(p_filters->'volumeRanges', '[]'::jsonb) AS volume_ranges,
      nullif(p_filters->>'brandId', '') AS brand_id,
      nullif(p_filters->>'brandModelId', '') AS brand_model_id,
      nullif(p_filters->>'brand', '') AS brand,
      nullif(p_filters->>'model', '') AS model,
      CASE WHEN (p_filters->>'minPrice') ~ '^[0-9]+(\.[0-9]+)?$' THEN (p_filters->>'minPrice')::numeric END AS min_price,
      CASE WHEN (p_filters->>'maxPrice') ~ '^[0-9]+(\.[0-9]+)?$' THEN (p_filters->>'maxPrice')::numeric END AS max_price,
      coalesce((p_filters->>'shippingAvailable')::boolean, false) AS shipping_available
  ),
  bbox AS (
    SELECT
      p_anchor_lat - (2200.0 * 1.08 / 69.0) AS min_lat,
      p_anchor_lat + (2200.0 * 1.08 / 69.0) AS max_lat,
      p_anchor_lng - (2200.0 * 1.08 / (69.0 * greatest(abs(cos(radians(p_anchor_lat))), 0.15))) AS min_lng,
      p_anchor_lng + (2200.0 * 1.08 / (69.0 * greatest(abs(cos(radians(p_anchor_lat))), 0.15))) AS max_lng
  ),
  filtered AS (
    SELECT
      l.id,
      3959.0 * acos(
        least(
          1.0,
          greatest(
            -1.0,
            cos(radians(p_anchor_lat)) * cos(radians(l.latitude)) *
              cos(radians(l.longitude) - radians(p_anchor_lng)) +
            sin(radians(p_anchor_lat)) * sin(radians(l.latitude))
          )
        )
      ) AS distance_mi,
      (
        btrim(coalesce(p_query, '')) = ''
        OR l.title ILIKE '%' || p_query || '%'
        OR l.description ILIKE '%' || p_query || '%'
        OR l.brand ILIKE '%' || p_query || '%'
        OR l.fins_setup ILIKE '%' || p_query || '%'
        OR l.tail_shape ILIKE '%' || p_query || '%'
        OR EXISTS (
          SELECT 1
          FROM public.categories c
          WHERE c.id = l.category_id
            AND c.board = true
            AND (c.name ILIKE '%' || p_query || '%' OR c.slug ILIKE '%' || p_query || '%')
        )
      ) AS keyword_match
    FROM public.listings l
    CROSS JOIN filter_values f
    CROSS JOIN bbox b
    WHERE l.status = 'active'
      AND l.section = 'surfboards'
      AND l.hidden_from_site = false
      AND l.archived_at IS NULL
      AND l.latitude BETWEEN b.min_lat AND b.max_lat
      AND l.longitude BETWEEN b.min_lng AND b.max_lng
      AND (
        (
          cardinality(f.board_types) = 0
          AND cardinality(f.category_ids) = 0
          AND cardinality(f.style_tags) = 0
        )
        OR l.board_type = ANY(f.board_types)
        OR l.category_id::text = ANY(f.category_ids)
        OR l.search_tags && f.style_tags
      )
      AND (cardinality(f.conditions) = 0 OR l.condition = ANY(f.conditions))
      AND (cardinality(f.fin_systems) = 0 OR l.fin_system = ANY(f.fin_systems))
      AND (cardinality(f.constructions) = 0 OR l.construction = ANY(f.constructions))
      AND (
        cardinality(f.fin_setups) = 0
        OR regexp_split_to_array(coalesce(l.fins_setup, ''), '\s*,\s*') && f.fin_setups
      )
      AND (
        jsonb_array_length(f.length_ranges) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(f.length_ranges)
            AS r(min_value double precision, max_value double precision)
          WHERE (r.min_value IS NULL OR l.length_total_inches >= r.min_value)
            AND (r.max_value IS NULL OR l.length_total_inches < r.max_value)
        )
      )
      AND (
        jsonb_array_length(f.volume_ranges) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(f.volume_ranges)
            AS r(min_value double precision, max_value double precision)
          WHERE (r.min_value IS NULL OR l.volume_liters >= r.min_value)
            AND (r.max_value IS NULL OR l.volume_liters < r.max_value)
        )
      )
      AND (f.min_price IS NULL OR l.price >= f.min_price)
      AND (f.max_price IS NULL OR l.price <= f.max_price)
      AND (NOT f.shipping_available OR l.shipping_available = true)
      AND (
        (f.brand_model_id IS NOT NULL AND l.brand_model_id::text = f.brand_model_id)
        OR (
          f.brand_model_id IS NULL
          AND f.brand_id IS NOT NULL
          AND l.brand_id::text = f.brand_id
        )
        OR (
          f.brand_model_id IS NULL
          AND f.brand_id IS NULL
          AND (f.brand IS NULL OR l.brand ILIKE '%' || f.brand || '%')
          AND (
            f.model IS NULL
            OR l.model ILIKE '%' || f.model || '%'
            OR l.title ILIKE '%' || f.model || '%'
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(f.dimension_tokens) token
        WHERE coalesce(l.dimensions, '') NOT ILIKE '%' || token || '%'
      )
  ),
  in_radius AS (
    SELECT
      filtered.*,
      CASE
        WHEN distance_mi <= 100.0 AND keyword_match THEN 1
        WHEN distance_mi <= 100.0 THEN 2
        WHEN keyword_match THEN 3
        ELSE 4
      END AS fallback_tier
    FROM filtered
    WHERE distance_mi <= 2200.0
  ),
  selected_tier AS (
    SELECT min(fallback_tier) AS fallback_tier
    FROM in_radius
  ),
  ranked AS (
    SELECT
      r.id,
      r.distance_mi,
      r.fallback_tier,
      count(*) OVER () AS total_count
    FROM in_radius r
    CROSS JOIN selected_tier s
    WHERE r.fallback_tier = s.fallback_tier
    ORDER BY r.distance_mi ASC, r.id ASC
    LIMIT least(greatest(coalesce(p_limit, 30), 1), 100)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  )
  SELECT
    ranked.id,
    CASE ranked.fallback_tier
      WHEN 1 THEN 'near-keyword'
      WHEN 2 THEN 'near-relaxed'
      WHEN 3 THEN 'wide-keyword'
      ELSE 'wide-relaxed'
    END AS fallback_kind,
    ranked.total_count
  FROM ranked;
$$;

COMMENT ON FUNCTION public.boards_browse_geo_fallback(
  double precision,
  double precision,
  text,
  jsonb,
  integer,
  integer
) IS
  'RLS-invoker surfboard fallback: applies browse filters, ranks keyword/distance tiers, and returns one bounded ID page.';

REVOKE ALL ON FUNCTION public.boards_browse_geo_fallback(
  double precision,
  double precision,
  text,
  jsonb,
  integer,
  integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boards_browse_geo_fallback(
  double precision,
  double precision,
  text,
  jsonb,
  integer,
  integer
) TO anon, authenticated;

COMMIT;
