-- Stop auto vacation: unanswered buyer messages no longer hide listings.
-- Day 6 hide warnings and day 7 vacation mode are off. The cron still sends
-- the day-3 "are you still here?" reminder. Rows that already got a later
-- milestone (warning or vacation) stay excluded so we do not re-nudge them.

COMMENT ON COLUMN public.seller_message_inactivity_actions.vacation_applied_at IS
  'Legacy: when auto vacation hid the listing. No longer written; sellers turn vacation on themselves.';
COMMENT ON COLUMN public.seller_message_inactivity_actions.warning_6d_at IS
  'Legacy: when the day-6 hide warning was sent. No longer written.';
COMMENT ON COLUMN public.seller_message_inactivity_actions.hidden_notified_at IS
  'Legacy: when the day-7 auto-hidden in-app notice was sent. No longer written.';

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
    AND a.reminder_3d_at IS NULL
    AND a.warning_6d_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.support_conversation_id = c.id
    );
$$;

REVOKE ALL ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) TO service_role;
