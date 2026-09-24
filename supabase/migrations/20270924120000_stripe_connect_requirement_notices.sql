-- Remember which Stripe requirement set we already told the seller about,
-- and allow the in-app notice that points them at Earnings to update it.

ALTER TABLE public.stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS requirements_notice_fingerprint text;

COMMENT ON COLUMN public.stripe_connect_accounts.requirements_notice_fingerprint IS
  'Sorted Stripe requirement field keys last announced in-app. Null when nothing is due.';

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'listing_saved',
    'offer_received',
    'offer_countered',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'offer_expired',
    'offer_expiring_soon',
    'new_listing_from_followed',
    'price_drop_from_followed',
    'payout_info_required'
  ));
