-- Store customers are private per consignment shop. Only that store's owner/staff may read rows;
-- all writes go through the service role in server actions (never direct client INSERT).

REVOKE ALL ON public.store_customers FROM anon;
GRANT SELECT ON public.store_customers TO authenticated;

COMMENT ON TABLE public.store_customers IS
  'Per-store walk-in customer list captured at POS or added by shop staff. RLS restricts SELECT to the owning store team only; not visible to other shops or general Reswell buyers.';
