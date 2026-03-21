-- Shipping address from Stripe Checkout (surfboard card purchases)
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

COMMENT ON COLUMN public.purchases.shipping_address IS 'Buyer shipping address from Stripe Checkout when delivery was selected';
COMMENT ON COLUMN public.purchases.stripe_checkout_session_id IS 'Stripe Checkout Session id for support and reconciliation';
