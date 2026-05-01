-- Fix stale chats ordering/timestamps: participants had no UPDATE on conversations,
-- so JS updates to last_message_at were blocked by RLS while messages inserted successfully.
--
-- 1) Allow buyer/seller to update thread metadata (listing_id, last_message_at, etc.).
-- 2) DB trigger keeps last_message_at aligned with inserted message rows (belt + suspenders).
-- 3) Backfill conversations from MAX(messages.created_at).

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant"
  ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = GREATEST(
    COALESCE(last_message_at, NEW.created_at),
    NEW.created_at
  )
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_conversation_last_message_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS messages_bump_conversation_last_message_at ON public.messages;
CREATE TRIGGER messages_bump_conversation_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_conversation_last_message_at();

UPDATE public.conversations c
SET last_message_at = sub.mx
FROM (
  SELECT conversation_id, MAX(created_at) AS mx
  FROM public.messages
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id;
