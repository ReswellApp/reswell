-- First-party SPA page views + visitor keys (same payloads as Klaviyo page-view tracker).
-- RLS enabled with no grants to anon/authenticated; inserts and reads via service_role only.

CREATE TABLE public.site_traffic_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  visitor_key text NOT NULL,
  pathname text NOT NULL,
  CONSTRAINT site_traffic_visitor_key_len CHECK (
    char_length(visitor_key) >= 8 AND char_length(visitor_key) <= 200
  ),
  CONSTRAINT site_traffic_pathname_len CHECK (char_length(pathname) <= 2048)
);

CREATE INDEX site_traffic_page_views_occurred_at_idx
  ON public.site_traffic_page_views (occurred_at DESC);

COMMENT ON TABLE public.site_traffic_page_views IS 'Client-reported SPA navigation events (paired with Klaviyo page-view route). Visitor key: user:<uuid> or anon:<anonymous_id>.';

ALTER TABLE public.site_traffic_page_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_site_traffic_dashboard(p_months integer DEFAULT 24)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
  params AS (
    SELECT LEAST(GREATEST(p_months, 1), 60)::integer AS mcount
  ),
  rollup AS (
    SELECT
      (SELECT COUNT(*)::bigint FROM public.site_traffic_page_views
       WHERE occurred_at >= now() - interval '7 days') AS pv_7,
      (SELECT COUNT(DISTINCT visitor_key)::bigint FROM public.site_traffic_page_views
       WHERE occurred_at >= now() - interval '7 days') AS uv_7,
      (SELECT COUNT(*)::bigint FROM public.site_traffic_page_views
       WHERE occurred_at >= now() - interval '30 days') AS pv_30,
      (SELECT COUNT(DISTINCT visitor_key)::bigint FROM public.site_traffic_page_views
       WHERE occurred_at >= now() - interval '30 days') AS uv_30
  ),
  monthly AS (
    SELECT
      date_trunc('month', occurred_at) AS month_bucket,
      COUNT(*)::bigint AS page_views,
      COUNT(DISTINCT visitor_key)::bigint AS unique_visitors
    FROM public.site_traffic_page_views
    WHERE occurred_at >= (
      date_trunc('month', now())
      - (((SELECT mcount FROM params) - 1) * interval '1 month')
    )
    GROUP BY month_bucket
  )
SELECT jsonb_build_object(
  'last7Days',
  jsonb_build_object(
    'pageViews', r.pv_7,
    'uniqueVisitors', r.uv_7
  ),
  'last30Days',
  jsonb_build_object(
    'pageViews', r.pv_30,
    'uniqueVisitors', r.uv_30
  ),
  'byMonth',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'monthStart', to_char(m.month_bucket::date, 'YYYY-MM-DD'),
          'monthLabel', trim(to_char(m.month_bucket, 'FMMonth YYYY')),
          'pageViews', m.page_views,
          'uniqueVisitors', m.unique_visitors
        )
        ORDER BY m.month_bucket DESC
      )
      FROM monthly m
    ),
    '[]'::jsonb
  )
)
FROM rollup r;
$$;

REVOKE ALL ON FUNCTION public.admin_site_traffic_dashboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_site_traffic_dashboard(integer) TO service_role;

COMMENT ON FUNCTION public.admin_site_traffic_dashboard(integer) IS 'Aggregated site traffic for admin (service_role RPC). Months are calendar buckets in DB timezone (UTC on Supabase).';
