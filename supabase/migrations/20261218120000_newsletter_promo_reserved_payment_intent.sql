-- Fix databases where newsletter_promo_codes was created before reserved_payment_intent_id
-- existed in the initial migration (CREATE TABLE IF NOT EXISTS skips column adds).

ALTER TABLE public.newsletter_promo_codes
  ADD COLUMN IF NOT EXISTS reserved_payment_intent_id text;

COMMENT ON COLUMN public.newsletter_promo_codes.reserved_payment_intent_id IS
  'Stripe PaymentIntent id holding this code between checkout start and order finalize.';
