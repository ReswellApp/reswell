-- Ensure authenticated staff can use ops RLS helpers + tables via PostgREST.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, UPDATE ON TABLE public.ops_groups TO authenticated, service_role;
GRANT SELECT ON TABLE public.ops_signals TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ops_fix_tickets TO authenticated, service_role;
GRANT SELECT ON TABLE public.ops_ingest_runs TO authenticated, service_role;

-- Ingest / report paths use the service role
GRANT ALL ON TABLE public.ops_groups TO service_role;
GRANT ALL ON TABLE public.ops_signals TO service_role;
GRANT ALL ON TABLE public.ops_fix_tickets TO service_role;
GRANT ALL ON TABLE public.ops_ingest_runs TO service_role;

GRANT EXECUTE ON FUNCTION public.is_admin_or_employee() TO authenticated, service_role;

-- Force PostgREST to reload schema cache after DDL
NOTIFY pgrst, 'reload schema';
