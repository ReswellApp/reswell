-- Visitor newsletter promo: unique one-time 10% codes (Reswell-funded; sellers unaffected).

CREATE TABLE IF NOT EXISTS public.newsletter_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  discount_percent integer NOT NULL DEFAULT 10
    CHECK (discount_percent > 0 AND discount_percent <= 100),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by_profile_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  redeemed_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  reserved_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_promo_codes_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT newsletter_promo_codes_code_normalized CHECK (code = upper(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_promo_codes_code_uidx
  ON public.newsletter_promo_codes (code);

CREATE INDEX IF NOT EXISTS newsletter_promo_codes_email_idx
  ON public.newsletter_promo_codes (lower(email));

CREATE INDEX IF NOT EXISTS newsletter_promo_codes_active_idx
  ON public.newsletter_promo_codes (expires_at)
  WHERE redeemed_at IS NULL;

COMMENT ON TABLE public.newsletter_promo_codes IS
  'One-time newsletter welcome codes (10% off item price). Reswell absorbs discount; seller earnings use full item price.';

COMMENT ON COLUMN public.newsletter_promo_codes.reserved_payment_intent_id IS
  'Stripe PaymentIntent id holding this code between checkout start and order finalize.';

ALTER TABLE public.newsletter_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_promo_codes_none" ON public.newsletter_promo_codes;
CREATE POLICY "newsletter_promo_codes_none"
  ON public.newsletter_promo_codes FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_promo_codes TO service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES public.newsletter_promo_codes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_discount_usd numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.promo_code_id IS
  'Newsletter welcome promo applied at checkout (Reswell-funded discount).';

COMMENT ON COLUMN public.orders.promo_discount_usd IS
  'USD discount applied to item subtotal from a newsletter promo code.';
