-- Admin-issued one-time promo codes (Reswell-funded; any signed-in buyer may redeem).

CREATE TABLE IF NOT EXISTS public.admin_issued_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_percent integer NOT NULL
    CHECK (discount_percent > 0 AND discount_percent <= 100),
  note text,
  expires_at timestamptz NOT NULL,
  created_by_profile_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  redeemed_by_profile_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  redeemed_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  reserved_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_issued_promo_codes_code_normalized CHECK (code = upper(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_issued_promo_codes_code_uidx
  ON public.admin_issued_promo_codes (code);

CREATE INDEX IF NOT EXISTS admin_issued_promo_codes_active_idx
  ON public.admin_issued_promo_codes (expires_at)
  WHERE redeemed_at IS NULL;

COMMENT ON TABLE public.admin_issued_promo_codes IS
  'One-time admin-generated promo codes. Reswell absorbs discount; seller earnings use full item price.';

COMMENT ON COLUMN public.admin_issued_promo_codes.note IS
  'Optional internal label for admins (not shown at checkout).';

COMMENT ON COLUMN public.admin_issued_promo_codes.reserved_payment_intent_id IS
  'Stripe PaymentIntent id holding this code between checkout start and order finalize.';

ALTER TABLE public.admin_issued_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_issued_promo_codes_none" ON public.admin_issued_promo_codes;
CREATE POLICY "admin_issued_promo_codes_none"
  ON public.admin_issued_promo_codes FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_issued_promo_codes TO service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_promo_code_id uuid
    REFERENCES public.admin_issued_promo_codes (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.admin_promo_code_id IS
  'Admin-issued one-time promo applied at checkout (Reswell-funded discount).';
