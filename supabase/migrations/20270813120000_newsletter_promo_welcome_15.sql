-- Welcome newsletter promo is now 15% off. Existing 10% rows stay valid at 10%.

ALTER TABLE public.newsletter_promo_codes
  ALTER COLUMN discount_percent SET DEFAULT 15;

COMMENT ON TABLE public.newsletter_promo_codes IS
  'One-time newsletter welcome codes (15% off item price). Reswell absorbs discount; seller earnings use full item price. Existing 10% codes remain redeemable until expiry.';
