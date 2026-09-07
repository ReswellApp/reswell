-- Percentage tips (3/5/7% of listing price) can exceed the original $500 cap.
-- Minimum matches Stripe's USD card floor ($0.50) so small listings keep distinct percents.

ALTER TABLE public.seller_sale_tips
  DROP CONSTRAINT IF EXISTS seller_sale_tips_amount_cents_check;

ALTER TABLE public.seller_sale_tips
  ADD CONSTRAINT seller_sale_tips_amount_cents_check
  CHECK (amount_cents >= 50 AND amount_cents <= 250000);
