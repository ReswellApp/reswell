-- Allow conversation participants to mark messages as read (so opening a conversation updates is_read).
-- Required for the Messages nav badge to clear after opening an unread message.

DROP POLICY IF EXISTS "messages_update_own_conversation" ON public.messages;
CREATE POLICY "messages_update_own_conversation" ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
