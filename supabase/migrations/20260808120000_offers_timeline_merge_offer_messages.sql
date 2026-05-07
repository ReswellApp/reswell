-- Merge negotiation history from offer_messages into offers.offer_timeline (JSONB), then drop offer_messages.
-- Canonical structured timeline lives on offers; mirrored human-readable lines stay in conversations.messages.

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offer_timeline jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.offers.offer_timeline IS
  'Append-only negotiated events for this offer: OFFER, COUNTER, ACCEPT, DECLINE, etc. Replaces legacy offer_messages rows.';

-- Backfill from legacy table (chronological array per offer).
UPDATE public.offers o
SET offer_timeline = sq.timeline
FROM (
  SELECT
    om.offer_id,
    jsonb_agg(
      jsonb_build_object(
        'id', om.id,
        'sender_id', om.sender_id,
        'sender_role', om.sender_role::text,
        'action', om.action::text,
        'amount', om.amount,
        'note', om.note,
        'created_at', om.created_at
      )
      ORDER BY om.created_at ASC
    ) AS timeline
  FROM public.offer_messages om
  GROUP BY om.offer_id
) sq
WHERE o.id = sq.offer_id;

-- Server-only: append one event (service role). Keeps updates atomic vs read-modify-write races.
CREATE OR REPLACE FUNCTION public.append_offer_timeline(
  p_offer_id uuid,
  p_entry jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offers
  SET
    offer_timeline = COALESCE(offer_timeline, '[]'::jsonb) || jsonb_build_array(p_entry),
    updated_at = NOW()
  WHERE id = p_offer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer % not found', p_offer_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.append_offer_timeline(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_offer_timeline(uuid, jsonb) TO service_role;

DROP TABLE IF EXISTS public.offer_messages CASCADE;
