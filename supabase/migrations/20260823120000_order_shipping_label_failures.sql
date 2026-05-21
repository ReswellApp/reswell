-- Tracks automated Reswell shipping label purchase failures for admin follow-up.

CREATE TABLE IF NOT EXISTS public.order_shipping_label_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  failure_stage text NOT NULL CHECK (failure_stage IN (
    'shipengine_not_configured',
    'incomplete_address',
    'rate_quote',
    'rate_id',
    'label_purchase',
    'attach_label'
  )),
  error_message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_label_failures_open_order_idx
  ON public.order_shipping_label_failures (order_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS order_shipping_label_failures_open_created_idx
  ON public.order_shipping_label_failures (created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE public.order_shipping_label_failures IS
  'Open rows alert admins when post-checkout Reswell label automation fails; resolved when a label is attached or admin dismisses.';

ALTER TABLE public.order_shipping_label_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_shipping_label_failures_select_admin" ON public.order_shipping_label_failures;
CREATE POLICY "order_shipping_label_failures_select_admin"
  ON public.order_shipping_label_failures FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "order_shipping_label_failures_update_admin" ON public.order_shipping_label_failures;
CREATE POLICY "order_shipping_label_failures_update_admin"
  ON public.order_shipping_label_failures FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
