# Admin analytics rollup deployment

The site-traffic and Klaviyo admin dashboards retain their existing rolling
windows, UTC buckets, filters, exact unique counts, and top-recipient behavior.
Completed UTC dates are read from daily rollups. Partial boundary dates and
dates not yet covered are read from raw tables.

## Staged deploy and backfill

1. Apply `20271002120000_admin_analytics_daily_rollups.sql`. It creates empty
   rollups, coverage markers, one-date refresh RPCs, coverage-gated retention,
   and hybrid dashboard RPCs. No historical data is aggregated in the migration
   transaction.
2. Deploy the app and the `/api/cron/admin-analytics-rollups` schedule. It runs
   every two hours and processes at most three missing UTC dates per source.
   Every source/date is a separate RPC transaction and is safe to retry.
3. Track the cron response until `rolledUp` is empty. Compare
   `admin_analytics_rollup_coverage.source_rows` with raw daily counts for
   sampled dates. A coverage marker is committed in the same transaction as
   its rebuilt rollup.
4. Retention starts automatically but only deletes raw rows whose UTC date has
   a coverage marker. It removes at most 100,000 rows per source per invocation.
   Raw site traffic retains 45 days; raw Klaviyo events retain 90 days.
5. After catch-up, verify the admin traffic and notifications-center ranges
   against pre-deploy values. Query plans should read daily tables plus at most
   the two partial boundary dates. The 24-hour Klaviyo timeline remains an
   indexed raw scan so hourly buckets stay exact.

## Rollback

First disable the new cron schedule to stop retention. Restore the prior
dashboard function definitions from
`20260513183000_site_traffic_page_views.sql` and
`20270928120000_klaviyo_notifications_center.sql`. Do not drop rollup or
coverage tables during incident rollback; they are isolated from request-path
writes and preserve evidence for reconciliation.

Raw Klaviyo rows inside 90 days and site-traffic rows inside 45 days remain
available, so those dashboard windows can return to raw scans. Data older than
the retention cutoffs is intentionally recoverable only from the rollups or a
database backup.
