-- Phase 0.6: entry-point + fork instrumentation on sell_funnel_events.
-- Adds entry_point column and refreshes admin_sell_funnel_dashboard aggregates.

ALTER TABLE public.sell_funnel_events
  ADD COLUMN IF NOT EXISTS entry_point text;

CREATE INDEX IF NOT EXISTS sell_funnel_events_entry_point_created_at_idx
  ON public.sell_funnel_events (entry_point, created_at DESC)
  WHERE entry_point IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_sell_funnel_dashboard(
  p_days integer DEFAULT 30,
  p_listing_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_listing_type text := NULLIF(trim(p_listing_type), '');
  v_result jsonb;
BEGIN
  WITH windowed AS (
    SELECT *
    FROM public.sell_funnel_events e
    WHERE e.created_at >= v_since
      AND (v_listing_type IS NULL OR e.listing_type = v_listing_type)
  ),
  summary AS (
    SELECT
      COUNT(*) FILTER (WHERE event = 'publish_attempt')::bigint AS publish_attempts,
      COUNT(*) FILTER (WHERE event = 'publish_succeeded')::bigint AS publish_successes,
      COUNT(*) FILTER (WHERE event = 'validation_failed')::bigint AS validation_failures,
      COUNT(*) FILTER (WHERE event = 'upload_failed')::bigint AS upload_failures,
      COUNT(*) FILTER (WHERE event = 'publish_failed')::bigint AS publish_failures,
      COUNT(*) FILTER (WHERE event = 'flow_started')::bigint AS flow_starts,
      COUNT(*) FILTER (WHERE event = 'fork_to_full')::bigint AS fork_to_full,
      COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS unique_users,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)
        FILTER (WHERE event = 'publish_succeeded' AND duration_ms IS NOT NULL) AS median_duration_ms
    FROM windowed
  ),
  by_event AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event', event,
          'count', cnt,
          'uniqueUsers', uniq_users
        )
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        event,
        COUNT(*)::bigint AS cnt,
        COUNT(DISTINCT user_id)::bigint AS uniq_users
      FROM windowed
      GROUP BY event
    ) s
  ),
  by_listing_type AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'listingType', listing_type,
          'publishAttempts', publish_attempts,
          'publishSuccesses', publish_successes,
          'validationFailures', validation_failures,
          'flowStarts', flow_starts
        )
        ORDER BY publish_attempts DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        listing_type,
        COUNT(*) FILTER (WHERE event = 'publish_attempt')::bigint AS publish_attempts,
        COUNT(*) FILTER (WHERE event = 'publish_succeeded')::bigint AS publish_successes,
        COUNT(*) FILTER (WHERE event = 'validation_failed')::bigint AS validation_failures,
        COUNT(*) FILTER (WHERE event = 'flow_started')::bigint AS flow_starts
      FROM windowed
      GROUP BY listing_type
    ) t
  ),
  by_entry_point AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'entryPoint', entry_point,
          'flowStarts', flow_starts,
          'publishAttempts', publish_attempts,
          'publishSuccesses', publish_successes
        )
        ORDER BY flow_starts DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        COALESCE(NULLIF(trim(entry_point), ''), '(unknown)') AS entry_point,
        COUNT(*) FILTER (WHERE event = 'flow_started')::bigint AS flow_starts,
        COUNT(*) FILTER (WHERE event = 'publish_attempt')::bigint AS publish_attempts,
        COUNT(*) FILTER (WHERE event = 'publish_succeeded')::bigint AS publish_successes
      FROM windowed
      GROUP BY COALESCE(NULLIF(trim(entry_point), ''), '(unknown)')
    ) ep
  ),
  top_fields AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'field', field,
          'interactions', interactions,
          'validationFailures', validation_failures
        )
        ORDER BY interactions DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        COALESCE(field, '(unknown)') AS field,
        COUNT(*) FILTER (WHERE event = 'field_interacted')::bigint AS interactions,
        COUNT(*) FILTER (WHERE event = 'validation_failed')::bigint AS validation_failures
      FROM windowed
      WHERE field IS NOT NULL AND char_length(trim(field)) > 0
        AND event IN ('field_interacted', 'validation_failed')
      GROUP BY COALESCE(field, '(unknown)')
      ORDER BY interactions DESC
      LIMIT 25
    ) f
  ),
  top_validation AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'field', field,
          'message', message,
          'count', cnt
        )
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        COALESCE(field, '(unknown)') AS field,
        COALESCE(message, '') AS message,
        COUNT(*)::bigint AS cnt
      FROM windowed
      WHERE event = 'validation_failed'
      GROUP BY COALESCE(field, '(unknown)'), COALESCE(message, '')
      ORDER BY cnt DESC
      LIMIT 20
    ) v
  ),
  step_funnel AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'step', step,
          'viewed', viewed,
          'completed', completed
        )
        ORDER BY viewed DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        field AS step,
        COUNT(*) FILTER (WHERE event = 'step_viewed')::bigint AS viewed,
        COUNT(*) FILTER (WHERE event = 'step_completed')::bigint AS completed
      FROM windowed
      WHERE event IN ('step_viewed', 'step_completed')
        AND field IS NOT NULL
        AND char_length(trim(field)) > 0
      GROUP BY field
    ) st
  ),
  daily_trend AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'publishAttempts', publish_attempts,
          'publishSuccesses', publish_successes
        )
        ORDER BY day ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT
        (date_trunc('day', created_at AT TIME ZONE 'UTC'))::date AS day,
        COUNT(*) FILTER (WHERE event = 'publish_attempt')::bigint AS publish_attempts,
        COUNT(*) FILTER (WHERE event = 'publish_succeeded')::bigint AS publish_successes
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
          'listingType', listing_type,
          'event', event,
          'field', field,
          'message', message,
          'listingId', listing_id,
          'durationMs', duration_ms,
          'entryPoint', entry_point
        )
        ORDER BY created_at DESC
      ),
      '[]'::jsonb
    ) AS rows
    FROM (
      SELECT *
      FROM windowed
      ORDER BY created_at DESC
      LIMIT 50
    ) r
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'listingTypeFilter', v_listing_type,
    'summary', (
      SELECT jsonb_build_object(
        'publishAttempts', publish_attempts,
        'publishSuccesses', publish_successes,
        'validationFailures', validation_failures,
        'uploadFailures', upload_failures,
        'publishFailures', publish_failures,
        'flowStarts', flow_starts,
        'forkToFull', fork_to_full,
        'uniqueUsers', unique_users,
        'medianDurationMs', median_duration_ms,
        'successRate',
          CASE
            WHEN publish_attempts > 0
              THEN round((publish_successes::numeric / publish_attempts::numeric) * 100, 1)
            ELSE NULL
          END
      )
      FROM summary
    ),
    'byEvent', (SELECT rows FROM by_event),
    'byListingType', (SELECT rows FROM by_listing_type),
    'byEntryPoint', (SELECT rows FROM by_entry_point),
    'topFields', (SELECT rows FROM top_fields),
    'topValidationFailures', (SELECT rows FROM top_validation),
    'stepFunnel', (SELECT rows FROM step_funnel),
    'dailyTrend', (SELECT rows FROM daily_trend),
    'recentEvents', (SELECT rows FROM recent)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_sell_funnel_dashboard(integer, text) IS
  'Aggregated /sell funnel metrics for admin (service_role). Includes entry_point + fork_to_full.';
