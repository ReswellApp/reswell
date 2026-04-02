-- Log in with PayPal (Identity) — store verified payer id on profile.
-- App uses public.profiles (auth.users id = profiles.id).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_payer_id text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_display_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_connected_at timestamptz;
