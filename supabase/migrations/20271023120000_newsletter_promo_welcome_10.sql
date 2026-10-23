-- Welcome newsletter promo is 10% off again. Existing rows keep their stored percent.

ALTER TABLE public.newsletter_promo_codes
  ALTER COLUMN discount_percent SET DEFAULT 10;

COMMENT ON TABLE public.newsletter_promo_codes IS
  'One-time newsletter welcome codes (10% off item price). Reswell absorbs discount; seller earnings use full item price. Existing codes remain redeemable at their stored percent until expiry.';
