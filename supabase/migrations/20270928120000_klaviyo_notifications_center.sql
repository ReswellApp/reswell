-- Notifications center: category-aware event analytics, plus daily snapshots of
-- Klaviyo flow performance and metric ingest counts.

DROP FUNCTION IF EXISTS public.klaviyo_event_log_analytics(timestamptz, text);

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
AS $$
DECLARE
  v_bucket text := CASE WHEN p_bucket = 'hour' THEN 'hour' ELSE 'day' END;
  v_result jsonb;
BEGIN
  IF NOT public.klaviyo_event_log_is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'sent', COUNT(*) FILTER (WHERE status = 'sent'),
        'skipped', COUNT(*) FILTER (WHERE status = 'skipped'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'uniqueRecipients', COUNT(DISTINCT COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id))
      )
      FROM public.klaviyo_event_log
      WHERE created_at >= p_since
        AND (p_until IS NULL OR created_at < p_until)
        AND (
          p_metrics IS NULL
          OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
          OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
        )
    ),
    'byMetric', COALESCE((
      SELECT jsonb_agg(row_to_json(m) ORDER BY m.total DESC)
      FROM (
        SELECT
          metric_name AS metric,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(DISTINCT COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id)) AS "uniqueRecipients"
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since
          AND (p_until IS NULL OR created_at < p_until)
          AND (
            p_metrics IS NULL
            OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
            OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
          )
        GROUP BY metric_name
      ) m
    ), '[]'::jsonb),
    'bySkipReason', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.count DESC)
      FROM (
        SELECT COALESCE(skip_reason, 'Unknown') AS reason, COUNT(*) AS count
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since
          AND (p_until IS NULL OR created_at < p_until)
          AND status = 'skipped'
          AND (
            p_metrics IS NULL
            OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
            OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
          )
        GROUP BY COALESCE(skip_reason, 'Unknown')
      ) s
    ), '[]'::jsonb),
    'bySkipReasonByMetric', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.count DESC)
      FROM (
        SELECT
          metric_name AS metric,
          COALESCE(skip_reason, 'Unknown') AS reason,
          COUNT(*) AS count
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since
          AND (p_until IS NULL OR created_at < p_until)
          AND status = 'skipped'
          AND (
            p_metrics IS NULL
            OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
            OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
          )
        GROUP BY metric_name, COALESCE(skip_reason, 'Unknown')
      ) s
    ), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.bucket)
      FROM (
        SELECT
          date_trunc(v_bucket, created_at) AS bucket,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since
          AND (p_until IS NULL OR created_at < p_until)
          AND (
            p_metrics IS NULL
            OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
            OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
          )
        GROUP BY date_trunc(v_bucket, created_at)
      ) t
    ), '[]'::jsonb),
    'topRecipients', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.count DESC)
      FROM (
        SELECT
          COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id) AS identifier,
          MAX(profile_email) AS email,
          COUNT(*) AS count,
          COUNT(DISTINCT metric_name) AS metrics,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since
          AND (p_until IS NULL OR created_at < p_until)
          AND COALESCE(profile_external_id, profile_email, profile_anonymous_id) IS NOT NULL
          AND (
            p_metrics IS NULL
            OR (p_exclude_metrics IS NOT TRUE AND metric_name = ANY(p_metrics))
            OR (p_exclude_metrics IS TRUE AND NOT (metric_name = ANY(p_metrics)))
          )
        GROUP BY COALESCE(profile_external_id, lower(profile_email), profile_anonymous_id)
        ORDER BY count DESC
        LIMIT 25
      ) r
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- Daily Klaviyo flow performance. One row per flow, channel, and UTC day.
-- opens/clicks are Klaviyo unique-per-day counts, summed across messages in the flow.
CREATE TABLE IF NOT EXISTS public.klaviyo_flow_stats_daily (
  flow_id text NOT NULL,
  send_channel text NOT NULL,
  stat_date date NOT NULL,
  recipients integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  opens integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  bounces integer NOT NULL DEFAULT 0,
  unsubscribes integer NOT NULL DEFAULT 0,
  spam_complaints integer NOT NULL DEFAULT 0,
  conversion_value numeric(14, 2) NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flow_id, send_channel, stat_date)
);

CREATE INDEX IF NOT EXISTS klaviyo_flow_stats_daily_date_idx
  ON public.klaviyo_flow_stats_daily (stat_date);

COMMENT ON TABLE public.klaviyo_flow_stats_daily IS
  'Daily Klaviyo flow series snapshot (recipients, delivered, unique opens/clicks). Written by the service role; read by staff.';

ALTER TABLE public.klaviyo_flow_stats_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "klaviyo_flow_stats_daily_staff_select" ON public.klaviyo_flow_stats_daily;
CREATE POLICY "klaviyo_flow_stats_daily_staff_select" ON public.klaviyo_flow_stats_daily
  FOR SELECT
  TO authenticated
  USING (public.klaviyo_event_log_is_staff());

-- Daily count of events Klaviyo ingested, for reconciliation against klaviyo_event_log.
CREATE TABLE IF NOT EXISTS public.klaviyo_metric_counts_daily (
  metric_id text NOT NULL,
  metric_name text NOT NULL,
  stat_date date NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_id, stat_date)
);

CREATE INDEX IF NOT EXISTS klaviyo_metric_counts_daily_date_idx
  ON public.klaviyo_metric_counts_daily (stat_date);

COMMENT ON TABLE public.klaviyo_metric_counts_daily IS
  'Daily Klaviyo metric-aggregate counts for metrics we recently accepted. Written by the service role; read by staff.';

ALTER TABLE public.klaviyo_metric_counts_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "klaviyo_metric_counts_daily_staff_select" ON public.klaviyo_metric_counts_daily;
CREATE POLICY "klaviyo_metric_counts_daily_staff_select" ON public.klaviyo_metric_counts_daily
  FOR SELECT
  TO authenticated
  USING (public.klaviyo_event_log_is_staff());

CREATE OR REPLACE FUNCTION public.klaviyo_flow_performance(
  p_since date,
  p_until date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.klaviyo_event_log_is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'fetchedAt', (
      SELECT max(fetched_at)
      FROM public.klaviyo_flow_stats_daily
      WHERE stat_date >= p_since AND stat_date < p_until
    ),
    'byFlow', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.delivered DESC)
      FROM (
        SELECT
          flow_id AS "flowId",
          send_channel AS channel,
          SUM(recipients)::int AS recipients,
          SUM(delivered)::int AS delivered,
          SUM(opens)::int AS opens,
          SUM(clicks)::int AS clicks,
          SUM(bounces)::int AS bounces,
          SUM(unsubscribes)::int AS unsubscribes,
          SUM(spam_complaints)::int AS "spamComplaints",
          SUM(conversion_value) AS "conversionValue"
        FROM public.klaviyo_flow_stats_daily
        WHERE stat_date >= p_since AND stat_date < p_until
        GROUP BY flow_id, send_channel
      ) f
    ), '[]'::jsonb),
    'byMetric', COALESCE((
      SELECT jsonb_agg(row_to_json(m) ORDER BY m.count DESC)
      FROM (
        SELECT max(metric_name) AS metric, SUM(event_count)::int AS count
        FROM public.klaviyo_metric_counts_daily
        WHERE stat_date >= p_since AND stat_date < p_until
        GROUP BY metric_id
      ) m
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;
