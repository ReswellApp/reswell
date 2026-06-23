-- Admin temporary account lock + automated messaging rate limits.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_restricted_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS account_restricted_reason text NULL,
  ADD COLUMN IF NOT EXISTS message_rate_limited_until timestamptz NULL;

COMMENT ON COLUMN public.profiles.account_restricted_until IS
  'When set and in the future, the user may sign in but cannot send messages or complete purchases.';
COMMENT ON COLUMN public.profiles.account_restricted_reason IS
  'Internal admin note for why the account was restricted.';
COMMENT ON COLUMN public.profiles.message_rate_limited_until IS
  'Automated anti-spam cooldown — blocks outbound marketplace messages until this time.';

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
  SELECT COALESCE(
    COUNT(
      DISTINCT CASE
        WHEN c.buyer_id = p_sender_id THEN c.seller_id
        ELSE c.buyer_id
      END
    ),
    0
  )::integer
  FROM public.messages m
  INNER JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.sender_id = p_sender_id
    AND m.created_at >= p_since;
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
  );
$$;

REVOKE ALL ON FUNCTION public.count_distinct_dm_recipients_since(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sender_messaged_recipient_since(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_distinct_dm_recipients_since(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sender_messaged_recipient_since(uuid, uuid, timestamptz) TO service_role;
