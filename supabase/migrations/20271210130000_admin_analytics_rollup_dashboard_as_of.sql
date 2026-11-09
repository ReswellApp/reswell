-- Repair for 20271210120000_admin_analytics_daily_rollups.sql.
--
-- That apply failed at CREATE FUNCTION public.admin_site_traffic_dashboard:
-- a CTE column named current_time, which PostgreSQL resolves to the
-- builtin current_time (timetz) instead of the timestamptz column. Later
-- statements in that file (klaviyo analytics, grants, comments, PostgREST
-- reload) did not run. Earlier objects (tables, rollup RPCs,
-- site_traffic_window_stats) already exist and are left in place.
--
-- Idempotent: CREATE OR REPLACE / GRANT / COMMENT / NOTIFY. Does not drop
-- or rewrite already-applied rollup tables.

CREATE OR REPLACE FUNCTION public.admin_site_traffic_dashboard(p_months integer DEFAULT 24)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
WITH params AS (
  SELECT
    LEAST(GREATEST(p_months, 1), 60)::integer AS mcount,
    now() AS as_of
),
windows AS (
  SELECT
    public.site_traffic_window_stats(p.as_of - interval '7 days', p.as_of) AS last7,
    public.site_traffic_window_stats(p.as_of - interval '30 days', p.as_of) AS last30,
    p.as_of,
    p.mcount
  FROM params p
),
monthly AS (
  SELECT
    month_start,
    public.site_traffic_window_stats(
      month_start,
      LEAST(month_start + interval '1 month', w.as_of)
    ) AS stats
  FROM windows w
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', w.as_of)
      - ((w.mcount - 1) * interval '1 month'),
    date_trunc('month', w.as_of),
    interval '1 month'
  ) AS month_start
)
SELECT jsonb_build_object(
  'last7Days', w.last7,
  'last30Days', w.last30,
  'byMonth', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'monthStart', to_char(m.month_start::date, 'YYYY-MM-DD'),
        'monthLabel', trim(to_char(m.month_start, 'FMMonth YYYY')),
        'pageViews', (m.stats->>'pageViews')::bigint,
        'uniqueVisitors', (m.stats->>'uniqueVisitors')::bigint
      )
      ORDER BY m.month_start DESC
    )
    FROM monthly m
    WHERE (m.stats->>'pageViews')::bigint > 0
  ), '[]'::jsonb)
)
FROM windows w;
$$;

CREATE OR REPLACE FUNCTION public.klaviyo_event_log_analytics(
  p_since timestamptz,
  p_bucket text DEFAULT 'day',
  p_until timestamptz DEFAULT NULL,
  p_metrics text[] DEFAULT NULL,
  p_exclude_metrics boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  v_bucket text := CASE WHEN p_bucket = 'hour' THEN 'hour' ELSE 'day' END;
  v_until timestamptz := COALESCE(p_until, now());
  v_result jsonb;
BEGIN
  IF NOT public.klaviyo_event_log_is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_since IS NULL OR p_since >= v_until THEN
    RAISE EXCEPTION 'invalid analytics window';
  END IF;

  WITH covered_days AS (
    SELECT c.rollup_date
    FROM public.admin_analytics_rollup_coverage c
    WHERE v_bucket = 'day'
      AND c.source = 'klaviyo_event_log'
      AND c.rollup_date::timestamptz >= p_since
      AND (c.rollup_date + 1)::timestamptz <= v_until
  ),
  event_rows AS (
    SELECT
      d.rollup_date::timestamptz AS bucket,
      d.metric_name,
      d.status,
      d.skip_reason,
      d.event_count
    FROM public.klaviyo_event_log_daily d
    JOIN covered_days c USING (rollup_date)
    WHERE (
      p_metrics IS NULL
      OR (p_exclude_metrics IS NOT TRUE AND d.metric_name = ANY(p_metrics))
      OR (p_exclude_metrics IS TRUE AND NOT (d.metric_name = ANY(p_metrics)))
    )
    UNION ALL
    SELECT
      date_trunc(v_bucket, e.created_at) AS bucket,
      e.metric_name,
      e.status,
      CASE WHEN e.status = 'skipped' THEN COALESCE(e.skip_reason, 'Unknown') ELSE '' END,
      COUNT(*)::bigint
    FROM public.klaviyo_event_log e
    WHERE e.created_at >= p_since
      AND e.created_at < v_until
      AND NOT EXISTS (
        SELECT 1 FROM covered_days c
        WHERE c.rollup_date = (e.created_at AT TIME ZONE 'UTC')::date
      )
      AND (
        p_metrics IS NULL
        OR (p_exclude_metrics IS NOT TRUE AND e.metric_name = ANY(p_metrics))
        OR (p_exclude_metrics IS TRUE AND NOT (e.metric_name = ANY(p_metrics)))
      )
    GROUP BY
      date_trunc(v_bucket, e.created_at),
      e.metric_name,
      e.status,
      CASE WHEN e.status = 'skipped' THEN COALESCE(e.skip_reason, 'Unknown') ELSE '' END
  ),
  recipient_rows AS (
    SELECT
      r.recipient_key,
      r.profile_email,
      r.metric_name,
      r.status,
      r.event_count
    FROM public.klaviyo_event_log_daily_recipients r
    JOIN covered_days c USING (rollup_date)
    WHERE (
      p_metrics IS NULL
      OR (p_exclude_metrics IS NOT TRUE AND r.metric_name = ANY(p_metrics))
      OR (p_exclude_metrics IS TRUE AND NOT (r.metric_name = ANY(p_metrics)))
    )
    UNION ALL
    SELECT
      COALESCE(e.profile_external_id, lower(e.profile_email), e.profile_anonymous_id),
      MAX(e.profile_email),
      e.metric_name,
      e.status,
      COUNT(*)::bigint
    FROM public.klaviyo_event_log e
    WHERE e.created_at >= p_since
      AND e.created_at < v_until
      AND COALESCE(e.profile_external_id, e.profile_email, e.profile_anonymous_id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM covered_days c
        WHERE c.rollup_date = (e.created_at AT TIME ZONE 'UTC')::date
      )
      AND (
        p_metrics IS NULL
        OR (p_exclude_metrics IS NOT TRUE AND e.metric_name = ANY(p_metrics))
        OR (p_exclude_metrics IS TRUE AND NOT (e.metric_name = ANY(p_metrics)))
      )
    GROUP BY
      COALESCE(e.profile_external_id, lower(e.profile_email), e.profile_anonymous_id),
      e.metric_name,
      e.status
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'total', COALESCE((SELECT SUM(event_count) FROM event_rows), 0),
      'sent', COALESCE((SELECT SUM(event_count) FROM event_rows WHERE status = 'sent'), 0),
      'skipped', COALESCE((SELECT SUM(event_count) FROM event_rows WHERE status = 'skipped'), 0),
      'failed', COALESCE((SELECT SUM(event_count) FROM event_rows WHERE status = 'failed'), 0),
      'uniqueRecipients', (SELECT COUNT(DISTINCT recipient_key) FROM recipient_rows)
    ),
    'byMetric', COALESCE((
      SELECT jsonb_agg(row_to_json(m) ORDER BY m.total DESC)
      FROM (
        SELECT
          e.metric_name AS metric,
          SUM(e.event_count)::bigint AS total,
          SUM(e.event_count) FILTER (WHERE e.status = 'sent')::bigint AS sent,
          SUM(e.event_count) FILTER (WHERE e.status = 'skipped')::bigint AS skipped,
          SUM(e.event_count) FILTER (WHERE e.status = 'failed')::bigint AS failed,
          (SELECT COUNT(DISTINCT r.recipient_key)
           FROM recipient_rows r WHERE r.metric_name = e.metric_name) AS "uniqueRecipients"
        FROM event_rows e
        GROUP BY e.metric_name
      ) m
    ), '[]'::jsonb),
    'bySkipReason', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.count DESC)
      FROM (
        SELECT skip_reason AS reason, SUM(event_count)::bigint AS count
        FROM event_rows
        WHERE status = 'skipped'
        GROUP BY skip_reason
      ) s
    ), '[]'::jsonb),
    'bySkipReasonByMetric', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.count DESC)
      FROM (
        SELECT metric_name AS metric, skip_reason AS reason, SUM(event_count)::bigint AS count
        FROM event_rows
        WHERE status = 'skipped'
        GROUP BY metric_name, skip_reason
      ) s
    ), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.bucket)
      FROM (
        SELECT
          bucket,
          COALESCE(SUM(event_count) FILTER (WHERE status = 'sent'), 0)::bigint AS sent,
          COALESCE(SUM(event_count) FILTER (WHERE status = 'skipped'), 0)::bigint AS skipped,
          COALESCE(SUM(event_count) FILTER (WHERE status = 'failed'), 0)::bigint AS failed
        FROM event_rows
        GROUP BY bucket
      ) t
    ), '[]'::jsonb),
    'topRecipients', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.count DESC)
      FROM (
        SELECT
          recipient_key AS identifier,
          MAX(profile_email) AS email,
          SUM(event_count)::bigint AS count,
          COUNT(DISTINCT metric_name)::bigint AS metrics,
          COALESCE(SUM(event_count) FILTER (WHERE status = 'sent'), 0)::bigint AS sent
        FROM recipient_rows
        GROUP BY recipient_key
        ORDER BY count DESC
        LIMIT 25
      ) r
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_admin_analytics_rollup_day(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_admin_analytics_rollup_days(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_admin_analytics_raw(text, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.site_traffic_window_stats(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_admin_analytics_rollup_day(text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_admin_analytics_rollup_days(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_admin_analytics_raw(text, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.site_traffic_window_stats(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.refresh_admin_analytics_rollup_day(text, date) IS
  'Idempotently rebuilds one completed UTC source date and writes its coverage marker atomically.';
COMMENT ON FUNCTION public.prune_admin_analytics_raw(text, timestamptz, integer) IS
  'Deletes one bounded raw batch only where complete daily rollup coverage has been proven.';
COMMENT ON FUNCTION public.admin_site_traffic_dashboard(integer) IS
  'Exact UTC traffic windows from covered daily rollups plus bounded raw boundary dates.';
COMMENT ON FUNCTION public.klaviyo_event_log_analytics(timestamptz, text, timestamptz, text[], boolean) IS
  'Staff analytics from covered UTC daily rollups plus bounded raw boundary dates; hourly windows remain raw.';

NOTIFY pgrst, 'reload schema';
