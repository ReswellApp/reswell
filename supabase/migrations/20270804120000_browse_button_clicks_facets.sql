-- Extend browse click tracking with individual facet filter clicks
-- (style, condition, brand, price, …) per category.

alter table public.browse_button_clicks
  add column if not exists facet_key text,
  add column if not exists facet_value text;

create index if not exists browse_button_clicks_facet_category_idx
  on public.browse_button_clicks (category, button, facet_key, created_at desc)
  where button = 'facet';

CREATE OR REPLACE FUNCTION public.admin_browse_button_clicks_dashboard(
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_result jsonb;
BEGIN
  WITH windowed AS (
    SELECT *
    FROM public.browse_button_clicks e
    WHERE e.created_at >= v_since
  ),
  summary AS (
    SELECT
      COUNT(*)::bigint AS total_clicks,
      COUNT(*) FILTER (WHERE button = 'ship_to_me')::bigint AS ship_to_me_clicks,
      COUNT(*) FILTER (WHERE button = 'filter')::bigint AS filter_clicks,
      COUNT(*) FILTER (WHERE button = 'facet')::bigint AS facet_clicks,
      COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS unique_users
    FROM windowed
  ),
  ship_to_me AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE detail = 'enabled')::bigint AS enabled,
      COUNT(*) FILTER (WHERE detail = 'disabled')::bigint AS disabled,
      COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS unique_users
    FROM windowed
    WHERE button = 'ship_to_me'
  ),
  ship_daily AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'count', cnt
        )
        ORDER BY day ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::bigint AS cnt
      FROM windowed
      WHERE button = 'ship_to_me'
      GROUP BY 1
    ) s
  ),
  filter_by_category AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'category', category,
          'count', cnt,
          'uniqueUsers', uniq_users,
          'mobile', mobile,
          'desktop', desktop
        )
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        category,
        COUNT(*)::bigint AS cnt,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS uniq_users,
        COUNT(*) FILTER (WHERE detail = 'mobile')::bigint AS mobile,
        COUNT(*) FILTER (WHERE detail = 'desktop')::bigint AS desktop
      FROM windowed
      WHERE button = 'filter'
      GROUP BY category
    ) t
  ),
  facets_by_category AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'category', category,
          'facetKey', facet_key,
          'facetValue', facet_value,
          'count', cnt,
          'selectCount', select_cnt,
          'deselectCount', deselect_cnt,
          'setCount', set_cnt,
          'uniqueUsers', uniq_users
        )
        ORDER BY category ASC, cnt DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        category,
        COALESCE(facet_key, '(unknown)') AS facet_key,
        COALESCE(NULLIF(facet_value, ''), '(any)') AS facet_value,
        COUNT(*)::bigint AS cnt,
        COUNT(*) FILTER (WHERE detail = 'select')::bigint AS select_cnt,
        COUNT(*) FILTER (WHERE detail = 'deselect')::bigint AS deselect_cnt,
        COUNT(*) FILTER (WHERE detail IN ('set', 'clear'))::bigint AS set_cnt,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS uniq_users
      FROM windowed
      WHERE button = 'facet'
      GROUP BY category, COALESCE(facet_key, '(unknown)'), COALESCE(NULLIF(facet_value, ''), '(any)')
    ) f
  ),
  daily_trend AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'shipToMe', ship_to_me,
          'filter', filter_cnt,
          'facet', facet_cnt
        )
        ORDER BY day ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE button = 'ship_to_me')::bigint AS ship_to_me,
        COUNT(*) FILTER (WHERE button = 'filter')::bigint AS filter_cnt,
        COUNT(*) FILTER (WHERE button = 'facet')::bigint AS facet_cnt
      FROM windowed
      GROUP BY 1
    ) d
  ),
  recent AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'createdAt', created_at,
          'userId', user_id,
          'category', category,
          'button', button,
          'detail', detail,
          'facetKey', facet_key,
          'facetValue', facet_value
        )
        ORDER BY created_at DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        id::text AS id,
        created_at,
        user_id::text AS user_id,
        category,
        button,
        detail,
        facet_key,
        facet_value
      FROM windowed
      ORDER BY created_at DESC
      LIMIT 50
    ) r
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'summary', (
      SELECT jsonb_build_object(
        'totalClicks', total_clicks,
        'shipToMeClicks', ship_to_me_clicks,
        'filterClicks', filter_clicks,
        'facetClicks', facet_clicks,
        'uniqueUsers', unique_users
      )
      FROM summary
    ),
    'shipToMe', (
      SELECT jsonb_build_object(
        'total', total,
        'enabled', enabled,
        'disabled', disabled,
        'uniqueUsers', unique_users,
        'dailyTrend', (SELECT rows FROM ship_daily)
      )
      FROM ship_to_me
    ),
    'filterByCategory', (SELECT rows FROM filter_by_category),
    'facetsByCategory', (SELECT rows FROM facets_by_category),
    'dailyTrend', (SELECT rows FROM daily_trend),
    'recentEvents', (SELECT rows FROM recent)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_browse_button_clicks_dashboard(integer) IS
  'Aggregated browse button + facet filter click metrics for admin (service_role). Days window 1–365.';
