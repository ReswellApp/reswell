-- Remove the retired Platform Ops feature's exclusively owned tables.
-- Deliberately omit CASCADE so this migration fails rather than removing an
-- unexpected dependency introduced outside the feature.

DROP TABLE IF EXISTS public.ops_fix_tickets;
DROP TABLE IF EXISTS public.ops_signals;
DROP TABLE IF EXISTS public.ops_ingest_runs;
DROP TABLE IF EXISTS public.ops_groups;
