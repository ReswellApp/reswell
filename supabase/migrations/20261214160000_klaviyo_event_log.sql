-- Notifications center: durable log of every Klaviyo Events API call (sent / skipped / failed)
-- plus staff-only analytics RPCs. Klaviyo itself is fire-and-forget, so this table is the
-- system of record for "what did we send, to whom, and what got skipped".

CREATE TABLE IF NOT EXISTS public.klaviyo_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  skip_reason text,
  http_status integer,
  profile_email text,
  profile_external_id text,
  profile_anonymous_id text,
  unique_id text,
  value numeric(12, 2),
  value_currency text,
  properties jsonb,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS klaviyo_event_log_created_at_idx
  ON public.klaviyo_event_log (created_at DESC);
CREATE INDEX IF NOT EXISTS klaviyo_event_log_metric_idx
  ON public.klaviyo_event_log (metric_name);
CREATE INDEX IF NOT EXISTS klaviyo_event_log_status_idx
  ON public.klaviyo_event_log (status);
CREATE INDEX IF NOT EXISTS klaviyo_event_log_email_idx
  ON public.klaviyo_event_log (lower(profile_email)) WHERE profile_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS klaviyo_event_log_external_id_idx
  ON public.klaviyo_event_log (profile_external_id) WHERE profile_external_id IS NOT NULL;

COMMENT ON TABLE public.klaviyo_event_log IS
  'Append-only log of Klaviyo Events API calls. Inserted by the service role from sendKlaviyoServerEvent; read by staff via analytics RPCs.';

-- RLS: service role inserts (bypasses RLS); staff may read.
ALTER TABLE public.klaviyo_event_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.klaviyo_event_log_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
  );
$$;

DROP POLICY IF EXISTS "klaviyo_event_log_staff_select" ON public.klaviyo_event_log;
CREATE POLICY "klaviyo_event_log_staff_select" ON public.klaviyo_event_log
  FOR SELECT
  TO authenticated
  USING (public.klaviyo_event_log_is_staff());

-- ---------------------------------------------------------------------------
-- Analytics RPC: aggregate Klaviyo event log into a single JSON payload.
-- SECURITY DEFINER + explicit staff gate so it is safe to expose to authenticated.
-- p_bucket controls timeline granularity ('hour' or 'day').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.klaviyo_event_log_analytics(
  p_since timestamptz,
  p_bucket text DEFAULT 'day'
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
        GROUP BY metric_name
      ) m
    ), '[]'::jsonb),
    'bySkipReason', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.count DESC)
      FROM (
        SELECT COALESCE(skip_reason, 'Unknown') AS reason, COUNT(*) AS count
        FROM public.klaviyo_event_log
        WHERE created_at >= p_since AND status = 'skipped'
        GROUP BY COALESCE(skip_reason, 'Unknown')
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
          AND COALESCE(profile_external_id, profile_email, profile_anonymous_id) IS NOT NULL
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

-- ---------------------------------------------------------------------------
-- Analytics RPC: in-app notifications aggregates (cross-user, staff only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_notifications_analytics(
  p_since timestamptz,
  p_bucket text DEFAULT 'day'
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
        'read', COUNT(*) FILTER (WHERE is_read IS TRUE),
        'unread', COUNT(*) FILTER (WHERE is_read IS NOT TRUE),
        'uniqueUsers', COUNT(DISTINCT user_id)
      )
      FROM public.notifications
      WHERE created_at >= p_since
    ),
    'byType', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC)
      FROM (
        SELECT type, COUNT(*) AS count, COUNT(*) FILTER (WHERE is_read IS TRUE) AS read
        FROM public.notifications
        WHERE created_at >= p_since
        GROUP BY type
      ) t
    ), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(row_to_json(b) ORDER BY b.bucket)
      FROM (
        SELECT date_trunc(v_bucket, created_at) AS bucket, COUNT(*) AS count
        FROM public.notifications
        WHERE created_at >= p_since
        GROUP BY date_trunc(v_bucket, created_at)
      ) b
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;
