-- Seller-paid shipping labels (flat/free shipping orders): Stripe payment before ShipEngine purchase.

ALTER TABLE public.order_shipping_labels
  DROP CONSTRAINT IF EXISTS order_shipping_labels_origin_check;

ALTER TABLE public.order_shipping_labels
  ADD CONSTRAINT order_shipping_labels_origin_check
  CHECK (origin IN ('auto_reswell_checkout', 'seller_paid'));

ALTER TABLE public.order_shipping_labels
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS order_shipping_labels_stripe_pi_uidx
  ON public.order_shipping_labels (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.order_shipping_labels.stripe_payment_intent_id IS
  'Stripe PaymentIntent id when the seller paid for this label (seller_paid origin).';

COMMENT ON COLUMN public.order_shipping_labels.origin IS
  'How the label was created. auto_reswell_checkout = buyer-paid Reswell shipping at checkout. seller_paid = seller paid via Stripe on the sale page.';
