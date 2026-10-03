-- Spray rate-limit must count blocked fraud DMs. Bots were able to hit
-- unlimited recipients because policy-blocked text never lands in `messages`.

CREATE OR REPLACE FUNCTION public.count_distinct_dm_recipients_since(
  p_sender_id uuid,
  p_since timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT recipient_id), 0)::integer
  FROM (
    SELECT CASE
      WHEN c.buyer_id = p_sender_id THEN c.seller_id
      ELSE c.buyer_id
    END AS recipient_id
    FROM public.messages m
    INNER JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.sender_id = p_sender_id
      AND m.created_at >= p_since

    UNION

    SELECT f.recipient_id
    FROM public.fraud_messages f
    WHERE f.sender_id = p_sender_id
      AND f.created_at >= p_since
  ) recipients;
$$;

CREATE OR REPLACE FUNCTION public.sender_messaged_recipient_since(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_since timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    INNER JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.sender_id = p_sender_id
      AND m.created_at >= p_since
      AND (
        (c.buyer_id = p_sender_id AND c.seller_id = p_recipient_id)
        OR (c.seller_id = p_sender_id AND c.buyer_id = p_recipient_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.fraud_messages f
    WHERE f.sender_id = p_sender_id
      AND f.recipient_id = p_recipient_id
      AND f.created_at >= p_since
  );
$$;

COMMENT ON FUNCTION public.count_distinct_dm_recipients_since(uuid, timestamptz) IS
  'Distinct marketplace DM recipients in the window, including blocked fraud attempts.';

REVOKE ALL ON FUNCTION public.count_distinct_dm_recipients_since(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sender_messaged_recipient_since(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_distinct_dm_recipients_since(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sender_messaged_recipient_since(uuid, uuid, timestamptz) TO service_role;
