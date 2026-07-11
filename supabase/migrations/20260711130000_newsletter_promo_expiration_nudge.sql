-- Newsletter promo expiration nudge: unredeemed codes 3 days before expiry get bumped to 15% off
-- and Klaviyo **Newsletter Promo Expiring** (daily cron).

CREATE TABLE IF NOT EXISTS public.newsletter_promo_expiration_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.newsletter_promo_codes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  previous_discount_percent INTEGER NOT NULL,
  bumped_discount_percent INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  klaviyo_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_promo_expiration_nudges_promo_unique UNIQUE (promo_code_id)
);

CREATE INDEX IF NOT EXISTS newsletter_promo_expiration_nudges_email_idx
  ON public.newsletter_promo_expiration_nudges (email);

ALTER TABLE public.newsletter_promo_expiration_nudges ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.newsletter_promo_expiration_nudges TO service_role;

CREATE OR REPLACE FUNCTION public.newsletter_promos_eligible_for_expiration_nudge (
  p_reference_time timestamptz,
  p_bumped_discount_percent integer
)
RETURNS TABLE (
  promo_id uuid,
  email text,
  code text,
  discount_percent integer,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS promo_id,
    p.email,
    p.code,
    p.discount_percent,
    p.expires_at,
    p.created_at
  FROM public.newsletter_promo_codes p
  WHERE p.redeemed_at IS NULL
    AND p.expires_at > p_reference_time
    AND NOT EXISTS (
      SELECT 1
      FROM public.newsletter_promo_expiration_nudges n
      WHERE n.promo_code_id = p.id
    )
    AND (
      (p.expires_at AT TIME ZONE 'UTC')::date
        = ((p_reference_time AT TIME ZONE 'UTC')::date + 3)
      OR (
        p.discount_percent >= p_bumped_discount_percent
        AND (p.expires_at AT TIME ZONE 'UTC')::date
          > (p_reference_time AT TIME ZONE 'UTC')::date
        AND (p.expires_at AT TIME ZONE 'UTC')::date
          <= ((p_reference_time AT TIME ZONE 'UTC')::date + 3)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.newsletter_promos_eligible_for_expiration_nudge (timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsletter_promos_eligible_for_expiration_nudge (timestamptz, integer) TO service_role;
