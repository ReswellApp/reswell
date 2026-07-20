-- Mirror of supabase/migrations/20270720130000_ops_platform_grants.sql
-- Run this in the Supabase SQL editor if /admin/ops fails to load groups.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, UPDATE ON TABLE public.ops_groups TO authenticated, service_role;
GRANT SELECT ON TABLE public.ops_signals TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ops_fix_tickets TO authenticated, service_role;
GRANT SELECT ON TABLE public.ops_ingest_runs TO authenticated, service_role;

GRANT ALL ON TABLE public.ops_groups TO service_role;
GRANT ALL ON TABLE public.ops_signals TO service_role;
GRANT ALL ON TABLE public.ops_fix_tickets TO service_role;
GRANT ALL ON TABLE public.ops_ingest_runs TO service_role;

GRANT EXECUTE ON FUNCTION public.is_admin_or_employee() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
