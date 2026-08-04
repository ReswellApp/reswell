-- Browse UI click instrumentation: Ship to me (/boards) + Filter buttons on
-- category browse pages, for first-party admin analytics.

create table if not exists public.browse_button_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  category text not null,
  button text not null,
  detail text
);

create index if not exists browse_button_clicks_button_created_at_idx
  on public.browse_button_clicks (button, created_at desc);

create index if not exists browse_button_clicks_category_button_created_at_idx
  on public.browse_button_clicks (category, button, created_at desc);

alter table public.browse_button_clicks enable row level security;

-- Inserts come from the logBrowseButtonClickAction server action using the
-- caller's session (guests log with a null user_id). No client reads: analytics
-- queries go through the service role.
create policy "browse_button_clicks_insert_own"
  on public.browse_button_clicks
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Admin dashboard RPC (service_role only).
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
  daily_trend AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'shipToMe', ship_to_me,
          'filter', filter_cnt
        )
        ORDER BY day ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE button = 'ship_to_me')::bigint AS ship_to_me,
        COUNT(*) FILTER (WHERE button = 'filter')::bigint AS filter_cnt
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
          'detail', detail
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
        detail
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
    'dailyTrend', (SELECT rows FROM daily_trend),
    'recentEvents', (SELECT rows FROM recent)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_browse_button_clicks_dashboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_browse_button_clicks_dashboard(integer) TO service_role;

COMMENT ON FUNCTION public.admin_browse_button_clicks_dashboard(integer) IS
  'Aggregated browse button click metrics for admin (service_role). Days window 1–365.';
