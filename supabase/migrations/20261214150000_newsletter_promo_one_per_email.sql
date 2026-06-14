-- One welcome promo signup per email (lifetime).

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_promo_codes_email_uidx
  ON public.newsletter_promo_codes (email);

COMMENT ON INDEX public.newsletter_promo_codes_email_uidx IS
  'Each email may enter the visitor promo signup flow at most once.';
