-- Intercepted marketplace DM attempts (phone-like content). Inserts via service role; staff read via RLS.

CREATE TABLE IF NOT EXISTS public.fraud_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  reason_code TEXT NOT NULL DEFAULT 'phone_like' CHECK (reason_code IN ('phone_like')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_messages_created_at ON public.fraud_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_messages_conversation_id ON public.fraud_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_fraud_messages_sender_id ON public.fraud_messages (sender_id);

COMMENT ON TABLE public.fraud_messages IS
  'User-authored marketplace DM text that matched policy interception (no delivery to recipients). Written by server (service role).';

ALTER TABLE public.fraud_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fraud_messages_staff_select" ON public.fraud_messages;
CREATE POLICY "fraud_messages_staff_select" ON public.fraud_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
    )
  );
