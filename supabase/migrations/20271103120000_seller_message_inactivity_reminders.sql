-- Unanswered buyer messages now escalate before the listing is hidden:
-- day 3 in-app + Klaviyo "Seller Still Here",
-- day 6 in-app + Klaviyo "Seller Listing Hide Warning",
-- day 7 vacation mode (existing) plus an in-app notice.
-- One action row per buyer message. Null milestone timestamps mean that step
-- has not been sent yet, so a later cron run can still fire it.

ALTER TABLE public.seller_message_inactivity_actions
  ADD COLUMN IF NOT EXISTS reminder_3d_at timestamptz,
  ADD COLUMN IF NOT EXISTS warning_6d_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_notified_at timestamptz;

COMMENT ON COLUMN public.seller_message_inactivity_actions.reminder_3d_at IS
  'When the day-3 "are you still here?" in-app notice and Klaviyo Seller Still Here event were sent.';
COMMENT ON COLUMN public.seller_message_inactivity_actions.warning_6d_at IS
  'When the day-6 hide warning in-app notice and Klaviyo Seller Listing Hide Warning event were sent.';
COMMENT ON COLUMN public.seller_message_inactivity_actions.hidden_notified_at IS
  'When the day-7 in-app notice was sent after auto vacation hid the listing.';

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
    'seller_listing_auto_hidden'
  ));

-- Return live listing threads whose latest message is an unanswered buyer message
-- at least 3 days old, including which milestones are already recorded.
-- The app decides day 3 / day 6 / day 7 from those timestamps.

DROP FUNCTION IF EXISTS public.listings_eligible_for_seller_message_inactivity(timestamptz);

CREATE FUNCTION public.listings_eligible_for_seller_message_inactivity (
  p_cutoff timestamptz
)
RETURNS TABLE (
  conversation_id uuid,
  listing_id uuid,
  seller_id uuid,
  buyer_id uuid,
  buyer_message_id uuid,
  buyer_message_content text,
  buyer_message_at timestamptz,
  listing_title text,
  listing_slug text,
  listing_section text,
  reminder_3d_at timestamptz,
  warning_6d_at timestamptz,
  vacation_applied_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    c.listing_id,
    c.seller_id,
    c.buyer_id,
    lm.id AS buyer_message_id,
    lm.content AS buyer_message_content,
    lm.created_at AS buyer_message_at,
    l.title AS listing_title,
    l.slug AS listing_slug,
    l.section AS listing_section,
    a.reminder_3d_at,
    a.warning_6d_at,
    a.vacation_applied_at
  FROM public.conversations c
  INNER JOIN public.listings l ON l.id = c.listing_id
  INNER JOIN LATERAL (
    SELECT m.id, m.sender_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN public.seller_message_inactivity_actions a
    ON a.conversation_id = c.id
   AND a.buyer_message_id = lm.id
  WHERE c.listing_id IS NOT NULL
    AND lm.sender_id = c.buyer_id
    AND lm.created_at < p_cutoff
    AND l.status IN ('active', 'pending_sale')
    AND l.hidden_from_site = FALSE
    AND a.vacation_applied_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.support_conversation_id = c.id
    );
$$;

REVOKE ALL ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) TO service_role;
