-- Daily admin analytics rollups.
--
-- Deployment is intentionally non-blocking: this migration creates empty rollups and
-- the RPCs fall back to raw rows only for dates whose coverage marker is absent. The
-- cron backfills a few UTC dates per invocation, one RPC transaction per source/day.
-- Raw retention refuses to delete a row unless that row's complete UTC date is covered.

CREATE TABLE public.admin_analytics_rollup_coverage (
  source text NOT NULL CHECK (source IN ('site_traffic', 'klaviyo_event_log')),
  rollup_date date NOT NULL,
  source_rows bigint NOT NULL CHECK (source_rows >= 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, rollup_date)
);

CREATE TABLE public.site_traffic_daily (
  rollup_date date PRIMARY KEY,
  page_views bigint NOT NULL CHECK (page_views >= 0),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_traffic_daily_visitors (
  rollup_date date NOT NULL,
  visitor_key text NOT NULL,
  PRIMARY KEY (rollup_date, visitor_key)
);

CREATE TABLE public.klaviyo_event_log_daily (
  rollup_date date NOT NULL,
  metric_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  skip_reason text NOT NULL,
  event_count bigint NOT NULL CHECK (event_count > 0),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rollup_date, metric_name, status, skip_reason)
);

CREATE TABLE public.klaviyo_event_log_daily_recipients (
  rollup_date date NOT NULL,
  recipient_key text NOT NULL,
  profile_email text,
  metric_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  event_count bigint NOT NULL CHECK (event_count > 0),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rollup_date, recipient_key, metric_name, status)
);

CREATE INDEX klaviyo_event_log_daily_date_idx
  ON public.klaviyo_event_log_daily (rollup_date);
CREATE INDEX klaviyo_event_log_daily_recipients_date_idx
  ON public.klaviyo_event_log_daily_recipients (rollup_date);
CREATE INDEX klaviyo_event_log_daily_recipients_key_idx
  ON public.klaviyo_event_log_daily_recipients (recipient_key, rollup_date);

ALTER TABLE public.admin_analytics_rollup_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_traffic_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_traffic_daily_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klaviyo_event_log_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klaviyo_event_log_daily_recipients ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_analytics_rollup_coverage IS
  'Proof that one complete UTC source date was atomically rebuilt. Raw retention requires this marker.';
COMMENT ON TABLE public.site_traffic_daily IS
  'UTC daily site page-view totals. Exact cross-day visitors are in site_traffic_daily_visitors.';
COMMENT ON TABLE public.klaviyo_event_log_daily IS
  'UTC daily Klaviyo event counts by metric, status, and skip reason.';
COMMENT ON TABLE public.klaviyo_event_log_daily_recipients IS
  'UTC daily Klaviyo recipient/metric/status counts used for exact unique and top-recipient analytics.';

CREATE OR REPLACE FUNCTION public.refresh_admin_analytics_rollup_day(
  p_source text,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  v_rows bigint := 0;
  v_day_start timestamptz := p_date::timestamptz;
  v_day_end timestamptz := (p_date + 1)::timestamptz;
BEGIN
  IF p_source NOT IN ('site_traffic', 'klaviyo_event_log') THEN
    RAISE EXCEPTION 'unsupported analytics rollup source';
  END IF;
  IF p_date >= (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'only completed UTC dates may be rolled up';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_date::text, 0));

  DELETE FROM public.admin_analytics_rollup_coverage
  WHERE source = p_source AND rollup_date = p_date;

  IF p_source = 'site_traffic' THEN
    DELETE FROM public.site_traffic_daily_visitors WHERE rollup_date = p_date;
    DELETE FROM public.site_traffic_daily WHERE rollup_date = p_date;

    SELECT COUNT(*) INTO v_rows
    FROM public.site_traffic_page_views
    WHERE occurred_at >= v_day_start AND occurred_at < v_day_end;

    INSERT INTO public.site_traffic_daily (rollup_date, page_views, refreshed_at)
    VALUES (p_date, v_rows, now());

    INSERT INTO public.site_traffic_daily_visitors (rollup_date, visitor_key)
    SELECT p_date, visitor_key
    FROM public.site_traffic_page_views
    WHERE occurred_at >= v_day_start AND occurred_at < v_day_end
    GROUP BY visitor_key;
  ELSE
    DELETE FROM public.klaviyo_event_log_daily_recipients WHERE rollup_date = p_date;
    DELETE FROM public.klaviyo_event_log_daily WHERE rollup_date = p_date;

    SELECT COUNT(*) INTO v_rows
    FROM public.klaviyo_event_log
    WHERE created_at >= v_day_start AND created_at < v_day_end;

    INSERT INTO public.klaviyo_event_log_daily (
      rollup_date, metric_name, status, skip_reason, event_count, refreshed_at
    )
    SELECT
      p_date,
      metric_name,
      status,
      CASE WHEN status = 'skipped' THEN COALESCE(skip_reason, 'Unknown') ELSE '' END,
      COUNT(*)::bigint,
      now()
    FROM public.klaviyo_event_log
    WHERE created_at >= v_day_start AND created_at < v_day_end
    GROUP BY metric_name, status,
      CASE WHEN status = 'skipped' THEN COALESCE(skip_reason, 'Unknown') ELSE '' END;

    INSERT INTO public.klaviyo_event_log_daily_recipients (
      rollup_date, recipient_key, profile_email, metric_name, status, event_count, refreshed_at
    )
    SELECT
      p_date,
      COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id),
      MAX(profile_email),
      metric_name,
      status,
      COUNT(*)::bigint,
      now()
    FROM public.klaviyo_event_log
    WHERE created_at >= v_day_start
      AND created_at < v_day_end
      AND COALESCE(profile_external_id, profile_email, profile_anonymous_id) IS NOT NULL
    GROUP BY
      COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id),
      metric_name,
      status;
  END IF;

  INSERT INTO public.admin_analytics_rollup_coverage (
    source, rollup_date, source_rows, completed_at
  )
  VALUES (p_source, p_date, v_rows, now());

  RETURN jsonb_build_object(
    'source', p_source,
    'rollupDate', p_date,
    'sourceRows', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.next_admin_analytics_rollup_days(
  p_source text,
  p_limit integer DEFAULT 3
)
RETURNS TABLE(rollup_date date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  v_first date;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 3), 1), 7);
BEGIN
  IF p_source = 'site_traffic' THEN
    SELECT MIN(occurred_at)::date INTO v_first FROM public.site_traffic_page_views;
  ELSIF p_source = 'klaviyo_event_log' THEN
    SELECT MIN(created_at)::date INTO v_first FROM public.klaviyo_event_log;
  ELSE
    RAISE EXCEPTION 'unsupported analytics rollup source';
  END IF;

  IF v_first IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d::date
  FROM generate_series(
    v_first::timestamptz,
    ((now() AT TIME ZONE 'UTC')::date - 1)::timestamptz,
    interval '1 day'
  ) AS d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_analytics_rollup_coverage c
    WHERE c.source = p_source AND c.rollup_date = d::date
  )
  ORDER BY d
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_admin_analytics_raw(
  p_source text,
  p_before timestamptz,
  p_limit integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 10000);
  v_deleted integer := 0;
BEGIN
  IF p_before IS NULL OR p_before > now() - interval '1 day' THEN
    RAISE EXCEPTION 'unsafe analytics retention cutoff';
  END IF;

  IF p_source = 'site_traffic' THEN
    WITH doomed AS (
      SELECT p.ctid
      FROM public.site_traffic_page_views p
      WHERE p.occurred_at < p_before
        AND EXISTS (
          SELECT 1
          FROM public.admin_analytics_rollup_coverage c
          WHERE c.source = 'site_traffic'
            AND c.rollup_date = (p.occurred_at AT TIME ZONE 'UTC')::date
        )
      ORDER BY p.occurred_at
      LIMIT v_limit
    )
    DELETE FROM public.site_traffic_page_views p
    USING doomed d
    WHERE p.ctid = d.ctid;
  ELSIF p_source = 'klaviyo_event_log' THEN
    WITH doomed AS (
      SELECT e.ctid
      FROM public.klaviyo_event_log e
      WHERE e.created_at < p_before
        AND EXISTS (
          SELECT 1
          FROM public.admin_analytics_rollup_coverage c
          WHERE c.source = 'klaviyo_event_log'
            AND c.rollup_date = (e.created_at AT TIME ZONE 'UTC')::date
        )
      ORDER BY e.created_at
      LIMIT v_limit
    )
    DELETE FROM public.klaviyo_event_log e
    USING doomed d
    WHERE e.ctid = d.ctid;
  ELSE
    RAISE EXCEPTION 'unsupported analytics rollup source';
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_traffic_window_stats(
  p_since timestamptz,
  p_until timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
WITH covered_days AS (
  SELECT c.rollup_date
  FROM public.admin_analytics_rollup_coverage c
  WHERE c.source = 'site_traffic'
    AND c.rollup_date::timestamptz >= p_since
    AND (c.rollup_date + 1)::timestamptz <= p_until
),
page_views AS (
  SELECT COALESCE(SUM(d.page_views), 0)::bigint AS count
  FROM public.site_traffic_daily d
  JOIN covered_days c USING (rollup_date)
  UNION ALL
  SELECT COUNT(*)::bigint
  FROM public.site_traffic_page_views p
  WHERE p.occurred_at >= p_since
    AND p.occurred_at < p_until
    AND NOT EXISTS (
      SELECT 1 FROM covered_days c
      WHERE c.rollup_date = (p.occurred_at AT TIME ZONE 'UTC')::date
    )
),
visitors AS (
  SELECT v.visitor_key
  FROM public.site_traffic_daily_visitors v
  JOIN covered_days c USING (rollup_date)
  UNION
  SELECT p.visitor_key
  FROM public.site_traffic_page_views p
  WHERE p.occurred_at >= p_since
    AND p.occurred_at < p_until
    AND NOT EXISTS (
      SELECT 1 FROM covered_days c
      WHERE c.rollup_date = (p.occurred_at AT TIME ZONE 'UTC')::date
    )
)
SELECT jsonb_build_object(
  'pageViews', (SELECT SUM(count)::bigint FROM page_views),
  'uniqueVisitors', (SELECT COUNT(*)::bigint FROM visitors)
);
$$;

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
    now() AS current_time
),
windows AS (
  SELECT
    public.site_traffic_window_stats(current_time - interval '7 days', current_time) AS last7,
    public.site_traffic_window_stats(current_time - interval '30 days', current_time) AS last30,
    current_time,
    mcount
  FROM params
),
monthly AS (
  SELECT
    month_start,
    public.site_traffic_window_stats(
      month_start,
      LEAST(month_start + interval '1 month', w.current_time)
    ) AS stats
  FROM windows w
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', w.current_time)
      - ((w.mcount - 1) * interval '1 month'),
    date_trunc('month', w.current_time),
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
