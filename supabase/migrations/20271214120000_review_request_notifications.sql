-- In-app + push prompts after delivery/pickup: buyer rates the seller,
-- seller rates the buyer. Same fulfillment gate as marketplace order reviews.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'listing_saved',
    'listing_saved_digest',
    'offer_received',
    'offer_countered',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'offer_expired',
    'offer_expiring_soon',
    'new_listing_from_followed',
    'new_listing_from_followed_digest',
    'price_drop_from_followed',
    'payout_info_required',
    'order_delivered',
    'order_delivered_payout',
    'seller_message_waiting',
    'seller_listing_hide_warning',
    'seller_listing_auto_hidden',
    'review_seller_requested',
    'review_buyer_requested'
  ));
