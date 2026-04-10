-- Buyer-initiated help / cancellation / refund assistance — reviewed by admins.
CREATE TABLE IF NOT EXISTS public.order_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('help', 'cancel_order', 'refund_help')),
  body text NOT NULL,
  contacted_seller_first boolean,
  order_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_support_requests_order_id_idx ON public.order_support_requests (order_id);
CREATE INDEX IF NOT EXISTS order_support_requests_created_at_idx ON public.order_support_requests (created_at DESC);

COMMENT ON TABLE public.order_support_requests IS
  'Buyer requests about an order (questions, cancel, refund help). Staff review in admin.';

ALTER TABLE public.order_support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_support_requests_insert_as_buyer" ON public.order_support_requests;
CREATE POLICY "order_support_requests_insert_as_buyer" ON public.order_support_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.buyer_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "order_support_requests_select" ON public.order_support_requests;
CREATE POLICY "order_support_requests_select" ON public.order_support_requests
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );
