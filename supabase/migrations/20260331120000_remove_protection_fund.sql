-- Remove unused seller protection fund tables
-- Buyer protection is now funded from Reswell's 7% platform fee
-- No longer deducting 2% from seller payouts

DROP TABLE IF EXISTS public.seller_protection_contributions CASCADE;
DROP TABLE IF EXISTS public.seller_protection_fund CASCADE;

-- Turn on RLS wherever policies exist but were inactive (RLS off means policies are ignored).
-- Does not enable RLS on tables with zero policies — those still need explicit policies first.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policy pol
      JOIN pg_class pc ON pc.oid = pol.polrelid
      JOIN pg_namespace pn ON pn.oid = pc.relnamespace
      WHERE pn.nspname = 'public'
        AND pc.relname = r.tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    END IF;
  END LOOP;
END $$;

-- After deploy, list any public tables that still have RLS disabled (need policies + RLS, or drop):
-- SELECT n.nspname AS schemaname, c.relname AS tablename
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND NOT c.relrowsecurity
-- ORDER BY c.relname;
