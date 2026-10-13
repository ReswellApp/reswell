-- Private Realtime broadcast for an open marketplace thread.
-- The server publishes the saved message; only participants can subscribe.
-- Depends on public.user_is_conversation_participant from the messages SELECT policy.

CREATE OR REPLACE FUNCTION public.marketplace_thread_broadcast_visible(topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  prefix constant text := 'marketplace-thread:';
BEGIN
  IF topic IS NULL OR left(topic, char_length(prefix)) IS DISTINCT FROM prefix THEN
    RETURN false;
  END IF;

  BEGIN
    conv_id := substring(topic FROM char_length(prefix) + 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  RETURN public.user_is_conversation_participant(conv_id);
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_thread_broadcast_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_thread_broadcast_visible(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_thread_broadcast_visible(text) TO service_role;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages is missing; skip marketplace thread broadcast policy';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS marketplace_thread_broadcast_select ON realtime.messages';
  EXECUTE $policy$
    CREATE POLICY marketplace_thread_broadcast_select
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      realtime.messages.extension = 'broadcast'
      AND public.marketplace_thread_broadcast_visible(realtime.topic())
    )
  $policy$;
END $$;
