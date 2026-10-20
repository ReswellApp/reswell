-- Admin user cohort retention: signup-month cohorts × return months (Pacific).
-- "Active" = durable product activity (listings, orders, messages, favorites,
-- offers, signed-in listing views) plus auth last_sign_in_at (single point).

CREATE OR REPLACE FUNCTION public.admin_user_cohorts_dashboard(
  p_cohort_months integer DEFAULT 12,
  p_horizon_months integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort_months integer := GREATEST(1, LEAST(COALESCE(p_cohort_months, 12), 36));
  v_horizon_months integer := GREATEST(2, LEAST(COALESCE(p_horizon_months, 6), 12));
  v_tz text := 'America/Los_Angeles';
  v_result jsonb;
BEGIN
  WITH bounds AS (
    SELECT
      (date_trunc('month', timezone(v_tz, now())))::date AS current_month,
      (
        date_trunc('month', timezone(v_tz, now()))
        - ((v_cohort_months - 1) || ' months')::interval
      )::date AS earliest_cohort
  ),
  cohort_users AS (
    SELECT
      p.id AS user_id,
      (date_trunc('month', timezone(v_tz, p.created_at)))::date AS cohort_month
    FROM public.profiles p
    CROSS JOIN bounds b
    WHERE (date_trunc('month', timezone(v_tz, p.created_at)))::date >= b.earliest_cohort
  ),
  activity_raw AS (
    SELECT l.user_id, l.created_at AS occurred_at
    FROM public.listings l
    INNER JOIN cohort_users cu ON cu.user_id = l.user_id
    WHERE l.status IS DISTINCT FROM 'draft'

    UNION ALL
    SELECT o.buyer_id, o.created_at
    FROM public.orders o
    INNER JOIN cohort_users cu ON cu.user_id = o.buyer_id

    UNION ALL
    SELECT o.seller_id, o.created_at
    FROM public.orders o
    INNER JOIN cohort_users cu ON cu.user_id = o.seller_id

    UNION ALL
    SELECT m.sender_id, m.created_at
    FROM public.messages m
    INNER JOIN cohort_users cu ON cu.user_id = m.sender_id

    UNION ALL
    SELECT f.user_id, f.created_at
    FROM public.favorites f
    INNER JOIN cohort_users cu ON cu.user_id = f.user_id
    WHERE f.created_at IS NOT NULL

    UNION ALL
    SELECT ofr.buyer_id, ofr.created_at
    FROM public.offers ofr
    INNER JOIN cohort_users cu ON cu.user_id = ofr.buyer_id

    UNION ALL
    SELECT urv.user_id, urv.viewed_at
    FROM public.user_recently_viewed_listings urv
    INNER JOIN cohort_users cu ON cu.user_id = urv.user_id

    UNION ALL
    SELECT urv.user_id, urv.first_viewed_at
    FROM public.user_recently_viewed_listings urv
    INNER JOIN cohort_users cu ON cu.user_id = urv.user_id
    WHERE urv.first_viewed_at IS NOT NULL

    UNION ALL
    SELECT u.id, u.last_sign_in_at
    FROM auth.users u
    INNER JOIN cohort_users cu ON cu.user_id = u.id
    WHERE u.last_sign_in_at IS NOT NULL
  ),
  user_month_activity AS (
    SELECT DISTINCT
      cu.user_id,
      cu.cohort_month,
      (
        (EXTRACT(YEAR FROM m.act_month)::int - EXTRACT(YEAR FROM cu.cohort_month)::int) * 12
        + (EXTRACT(MONTH FROM m.act_month)::int - EXTRACT(MONTH FROM cu.cohort_month)::int)
      )::int AS month_offset
    FROM cohort_users cu
    INNER JOIN activity_raw ar ON ar.user_id = cu.user_id
    CROSS JOIN LATERAL (
      SELECT (date_trunc('month', timezone(v_tz, ar.occurred_at)))::date AS act_month
    ) m
    WHERE m.act_month >= cu.cohort_month
      AND (
        (EXTRACT(YEAR FROM m.act_month)::int - EXTRACT(YEAR FROM cu.cohort_month)::int) * 12
        + (EXTRACT(MONTH FROM m.act_month)::int - EXTRACT(MONTH FROM cu.cohort_month)::int)
      ) < v_horizon_months
  ),
  cohort_sizes AS (
    SELECT
      cohort_month,
      COUNT(*)::bigint AS size
    FROM cohort_users
    GROUP BY cohort_month
  ),
  retention_counts AS (
    SELECT
      cohort_month,
      month_offset,
      COUNT(DISTINCT user_id)::bigint AS users
    FROM user_month_activity
    GROUP BY cohort_month, month_offset
  ),
  return_months_per_user AS (
    SELECT
      user_id,
      cohort_month,
      COUNT(*) FILTER (WHERE month_offset >= 1)::int AS return_months
    FROM user_month_activity
    GROUP BY user_id, cohort_month
  ),
  return_freq AS (
    SELECT
      cohort_month,
      return_months,
      COUNT(*)::bigint AS users
    FROM return_months_per_user
    GROUP BY cohort_month, return_months
  ),
  zero_return_fill AS (
    SELECT
      cs.cohort_month,
      0 AS return_months,
      GREATEST(
        cs.size - COALESCE((
          SELECT SUM(rf.users)::bigint
          FROM return_freq rf
          WHERE rf.cohort_month = cs.cohort_month
            AND rf.return_months >= 1
        ), 0),
        0
      )::bigint AS users
    FROM cohort_sizes cs
  ),
  return_freq_rows AS (
    SELECT cohort_month, return_months, users FROM zero_return_fill
    UNION ALL
    SELECT cohort_month, return_months, users
    FROM return_freq
    WHERE return_months >= 1
  ),
  cohort_rows AS (
    SELECT
      to_char(cs.cohort_month, 'YYYY-MM') AS cohort_month,
      cs.size,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'offset', offs.month_offset,
              'users', COALESCE(rc.users, 0),
              'rate',
                CASE
                  WHEN (
                    cs.cohort_month
                    + (offs.month_offset || ' months')::interval
                  )::date > b.current_month THEN NULL
                  WHEN cs.size = 0 THEN 0::float8
                  ELSE ROUND((COALESCE(rc.users, 0)::numeric / cs.size::numeric) * 1000) / 1000.0
                END,
              'elapsed',
                (
                  cs.cohort_month
                  + (offs.month_offset || ' months')::interval
                )::date <= b.current_month
            )
            ORDER BY offs.month_offset
          ),
          '[]'::jsonb
        )
        FROM generate_series(0, v_horizon_months - 1) AS offs(month_offset)
        LEFT JOIN retention_counts rc
          ON rc.cohort_month = cs.cohort_month
         AND rc.month_offset = offs.month_offset
      ) AS retention,
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'returns', rfr.return_months,
              'users', rfr.users
            )
            ORDER BY rfr.return_months
          ),
          '[]'::jsonb
        )
        FROM return_freq_rows rfr
        WHERE rfr.cohort_month = cs.cohort_month
      ) AS return_frequency,
      CASE
        WHEN cs.size = 0 THEN 0::float8
        ELSE ROUND(
          COALESCE((
            SELECT SUM(rm.return_months)::numeric
            FROM return_months_per_user rm
            WHERE rm.cohort_month = cs.cohort_month
          ), 0) / cs.size::numeric,
          2
        )::float8
      END AS avg_return_months,
      (
        SELECT COUNT(*)::bigint
        FROM return_months_per_user rm
        WHERE rm.cohort_month = cs.cohort_month
          AND rm.return_months >= 1
      ) AS returned_users
    FROM cohort_sizes cs
    CROSS JOIN bounds b
  ),
  summary AS (
    SELECT
      COALESCE(SUM(cs.size), 0)::bigint AS total_users,
      COALESCE(SUM(cr.returned_users), 0)::bigint AS returned_users,
      CASE
        WHEN COALESCE(SUM(cs.size), 0) = 0 THEN NULL
        ELSE ROUND(
          (SUM(cr.returned_users)::numeric / SUM(cs.size)::numeric) * 1000
        ) / 1000.0
      END AS returned_rate,
      CASE
        WHEN COALESCE(
          SUM(
            CASE
              WHEN (cs.cohort_month + interval '1 month')::date <= b.current_month
              THEN cs.size
              ELSE 0
            END
          ),
          0
        ) = 0 THEN NULL
        ELSE ROUND(
          (
            SUM(
              CASE
                WHEN (cs.cohort_month + interval '1 month')::date <= b.current_month
                THEN COALESCE((
                  SELECT rc.users
                  FROM retention_counts rc
                  WHERE rc.cohort_month = cs.cohort_month
                    AND rc.month_offset = 1
                ), 0)
                ELSE 0
              END
            )::numeric
            / SUM(
              CASE
                WHEN (cs.cohort_month + interval '1 month')::date <= b.current_month
                THEN cs.size
                ELSE 0
              END
            )::numeric
          ) * 1000
        ) / 1000.0
      END AS m1_retention_rate,
      CASE
        WHEN COALESCE(SUM(cs.size), 0) = 0 THEN NULL
        ELSE ROUND(
          SUM(COALESCE(cr.avg_return_months, 0) * cs.size)::numeric
          / SUM(cs.size)::numeric,
          2
        )::float8
      END AS avg_return_months
    FROM cohort_sizes cs
    CROSS JOIN bounds b
    INNER JOIN cohort_rows cr ON cr.cohort_month = to_char(cs.cohort_month, 'YYYY-MM')
  )
  SELECT jsonb_build_object(
    'cohortMonths', v_cohort_months,
    'horizonMonths', v_horizon_months,
    'timezone', v_tz,
    'activityDefinition',
      'Product activity (listings, orders, messages, favorites, offers, signed-in listing views) and last sign-in.',
    'summary', (
      SELECT jsonb_build_object(
        'totalUsers', s.total_users,
        'returnedUsers', s.returned_users,
        'returnedRate', s.returned_rate,
        'm1RetentionRate', s.m1_retention_rate,
        'avgReturnMonths', s.avg_return_months
      )
      FROM summary s
    ),
    'cohorts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'cohortMonth', cr.cohort_month,
            'size', cr.size,
            'retention', cr.retention,
            'returnFrequency', cr.return_frequency,
            'avgReturnMonths', cr.avg_return_months,
            'returnedUsers', cr.returned_users
          )
          ORDER BY cr.cohort_month DESC
        ),
        '[]'::jsonb
      )
      FROM cohort_rows cr
    )
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'cohortMonths', v_cohort_months,
    'horizonMonths', v_horizon_months,
    'timezone', v_tz,
    'activityDefinition',
      'Product activity (listings, orders, messages, favorites, offers, signed-in listing views) and last sign-in.',
    'summary', jsonb_build_object(
      'totalUsers', 0,
      'returnedUsers', 0,
      'returnedRate', NULL,
      'm1RetentionRate', NULL,
      'avgReturnMonths', NULL
    ),
    'cohorts', '[]'::jsonb
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_cohorts_dashboard(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_cohorts_dashboard(integer, integer) TO service_role;

COMMENT ON FUNCTION public.admin_user_cohorts_dashboard(integer, integer) IS
  'Signup-month cohort retention and return-frequency matrix for admin analytics (Pacific months).';
