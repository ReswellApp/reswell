-- Outbound Reswell → member labels (not tied to a marketplace order).

CREATE TABLE IF NOT EXISTS public.admin_user_shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  label_pdf_url text,
  tracking_number text,
  tracking_carrier text,
  shipengine_rate_id text,
  label_cost_usd numeric(10, 2),
  label_cost_currency text,
  parcel_length_in numeric(8, 2) NOT NULL,
  parcel_width_in numeric(8, 2) NOT NULL,
  parcel_height_in numeric(8, 2) NOT NULL,
  parcel_weight_lb numeric(8, 2) NOT NULL,
  ship_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_user_shipping_labels_recipient_idx
  ON public.admin_user_shipping_labels (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_user_shipping_labels_created_at_idx
  ON public.admin_user_shipping_labels (created_at DESC);

COMMENT ON TABLE public.admin_user_shipping_labels IS
  'ShipEngine labels bought by admins to send a Reswell package to a member. Not order-fulfillment.';

ALTER TABLE public.admin_user_shipping_labels ENABLE ROW LEVEL SECURITY;
