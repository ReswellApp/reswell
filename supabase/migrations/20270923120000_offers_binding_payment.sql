-- Binding buyer offers: reserve a PaymentIntent at submit, capture on accept.

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.offers.payment_intent_id IS
  'Stripe PaymentIntent (manual capture) reserved when the buyer sent a binding offer. NULL for legacy, counters, and seller-initiated offers.';

COMMENT ON COLUMN public.offers.address_id IS
  'Buyer shipping address locked when the binding offer was authorized. NULL for pickup or non-binding offers.';

CREATE UNIQUE INDEX IF NOT EXISTS offers_payment_intent_id_uidx
  ON public.offers (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;
