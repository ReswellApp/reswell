-- Realtime authorizes each `messages` insert with the SELECT policy.
-- The old policy joined `conversations` inline. That check often times out
-- or fails inside Realtime, so the open thread never receives the row while
-- the public `profiles.unread_message_count` ticker still moves.
-- A security-definer lookup keeps the same participant rule without the join.

CREATE OR REPLACE FUNCTION public.user_is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conv_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_conversation_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_conversation_participant(uuid) TO service_role;

DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT
  USING (public.user_is_conversation_participant(conversation_id));
