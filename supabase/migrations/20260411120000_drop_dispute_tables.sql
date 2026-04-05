-- Remove dispute resolution tables, enums, RPCs, and dispute notification types.

DELETE FROM public.notifications
WHERE type IN (
  'dispute_opened',
  'dispute_seller_responded',
  'dispute_return_label_sent',
  'dispute_return_shipped',
  'dispute_return_received',
  'dispute_return_window_warning',
  'dispute_return_window_expired',
  'dispute_escalated',
  'dispute_refund_released',
  'dispute_resolved'
);

DROP FUNCTION IF EXISTS public.buyer_disputes_in_90d(uuid);
DROP FUNCTION IF EXISTS public.buyer_distinct_seller_dispute_count(uuid);
DROP FUNCTION IF EXISTS public.buyer_abandoned_returns(uuid);
DROP FUNCTION IF EXISTS public.seller_refund_rate(uuid);

DROP TABLE IF EXISTS public.dispute_flags CASCADE;
DROP TABLE IF EXISTS public.dispute_evidence CASCADE;
DROP TABLE IF EXISTS public.dispute_messages CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;

DROP FUNCTION IF EXISTS public.set_disputes_updated_at();

DROP TYPE IF EXISTS public.dispute_evidence_type_enum CASCADE;
DROP TYPE IF EXISTS public.dispute_sender_role_enum CASCADE;
DROP TYPE IF EXISTS public.dispute_resolution_enum CASCADE;
DROP TYPE IF EXISTS public.dispute_status_enum CASCADE;
DROP TYPE IF EXISTS public.dispute_reason_enum CASCADE;

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
    'price_drop_from_followed'
  ));
