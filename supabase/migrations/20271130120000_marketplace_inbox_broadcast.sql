-- Private Realtime broadcast for each participant's inbox ticker and list.
-- The server publishes the saved message; only that user can subscribe.
-- Thread bubbles keep using marketplace_thread_broadcast_visible.

CREATE OR REPLACE FUNCTION public.marketplace_inbox_broadcast_visible(topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inbox_user uuid;
  prefix constant text := 'marketplace-inbox:';
BEGIN
  IF topic IS NULL OR left(topic, char_length(prefix)) IS DISTINCT FROM prefix THEN
    RETURN false;
  END IF;

  BEGIN
    inbox_user := substring(topic FROM char_length(prefix) + 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  RETURN inbox_user = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_inbox_broadcast_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_inbox_broadcast_visible(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_inbox_broadcast_visible(text) TO service_role;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages is missing; skip marketplace inbox broadcast policy';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS marketplace_inbox_broadcast_select ON realtime.messages';
  EXECUTE $policy$
    CREATE POLICY marketplace_inbox_broadcast_select
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      realtime.messages.extension = 'broadcast'
      AND public.marketplace_inbox_broadcast_visible(realtime.topic())
    )
  $policy$;
END $$;
