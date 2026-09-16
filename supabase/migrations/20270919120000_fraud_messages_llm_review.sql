-- Gemini second-pass review of intercepted marketplace DMs.

ALTER TABLE public.fraud_messages
  ADD COLUMN IF NOT EXISTS llm_review_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.fraud_messages
  ADD COLUMN IF NOT EXISTS llm_review_reason_code TEXT;

ALTER TABLE public.fraud_messages
  ADD COLUMN IF NOT EXISTS llm_review_rationale TEXT;

ALTER TABLE public.fraud_messages
  ADD COLUMN IF NOT EXISTS llm_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.fraud_messages
  ADD COLUMN IF NOT EXISTS llm_review_source TEXT;

ALTER TABLE public.fraud_messages
  DROP CONSTRAINT IF EXISTS fraud_messages_llm_review_status_check;

ALTER TABLE public.fraud_messages
  ADD CONSTRAINT fraud_messages_llm_review_status_check
  CHECK (
    llm_review_status IN ('pending', 'confirmed', 'dismissed', 'unavailable')
  );

ALTER TABLE public.fraud_messages
  DROP CONSTRAINT IF EXISTS fraud_messages_llm_review_source_check;

ALTER TABLE public.fraud_messages
  ADD CONSTRAINT fraud_messages_llm_review_source_check
  CHECK (
    llm_review_source IS NULL
    OR llm_review_source IN ('send', 'batch')
  );

CREATE INDEX IF NOT EXISTS idx_fraud_messages_llm_review_pending
  ON public.fraud_messages (created_at ASC)
  WHERE llm_review_status = 'pending';

COMMENT ON COLUMN public.fraud_messages.llm_review_status IS
  'Gemini confirm/dismiss of the regex heuristic: pending, confirmed, dismissed, or unavailable.';

COMMENT ON TABLE public.fraud_messages IS
  'User-authored marketplace DM text that matched policy interception. Phone, email, off-platform payment, phishing, and evasion are blocked before delivery. Gemini confirms or dismisses false-positive wording.';
