-- Hot path: idempotent Klaviyo sends look up
--   status = 'sent' AND unique_id = ANY(...)
-- pg_stat_statements (Aug 2026): ~25k calls, ~94ms mean, Parallel Seq Scan on 215k rows.
-- Partial unique_id index matches that predicate and keeps writes cheap for null unique_ids.

CREATE INDEX IF NOT EXISTS klaviyo_event_log_sent_unique_id_idx
  ON public.klaviyo_event_log (unique_id)
  WHERE status = 'sent' AND unique_id IS NOT NULL;

COMMENT ON INDEX public.klaviyo_event_log_sent_unique_id_idx IS
  'Speeds Klaviyo send-idempotency checks (status=sent + unique_id = ANY).';
