-- Seller message inactivity: when a buyer's latest message goes unanswered for 7+ days,
-- cron applies listing vacation mode and emits Klaviyo **Inactive Seller**.

CREATE TABLE IF NOT EXISTS public.seller_message_inactivity_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  buyer_message_at TIMESTAMPTZ NOT NULL,
  vacation_applied_at TIMESTAMPTZ,
  klaviyo_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seller_message_inactivity_actions_buyer_msg_unique
    UNIQUE (conversation_id, buyer_message_id)
);

CREATE INDEX IF NOT EXISTS seller_message_inactivity_actions_listing_idx
  ON public.seller_message_inactivity_actions (listing_id);

CREATE INDEX IF NOT EXISTS seller_message_inactivity_actions_seller_idx
  ON public.seller_message_inactivity_actions (seller_id);

ALTER TABLE public.seller_message_inactivity_actions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.seller_message_inactivity_actions TO service_role;

CREATE OR REPLACE FUNCTION public.listings_eligible_for_seller_message_inactivity (
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
  listing_section text
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
    l.section AS listing_section
  FROM public.conversations c
  INNER JOIN public.listings l ON l.id = c.listing_id
  INNER JOIN LATERAL (
    SELECT m.id, m.sender_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE c.listing_id IS NOT NULL
    AND lm.sender_id = c.buyer_id
    AND lm.created_at < p_cutoff
    AND l.status IN ('active', 'pending_sale')
    AND l.hidden_from_site = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.support_conversation_id = c.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.seller_message_inactivity_actions a
      WHERE a.conversation_id = c.id
        AND a.buyer_message_id = lm.id
    );
$$;

REVOKE ALL ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listings_eligible_for_seller_message_inactivity (timestamptz) TO service_role;
