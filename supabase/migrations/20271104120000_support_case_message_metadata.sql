-- Photo attachments on help thread messages (same bucket as claim evidence uploads).

ALTER TABLE public.support_case_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.support_case_messages.metadata IS
  'Optional attachment payload for member/agent messages (image in support-case-attachments bucket).';
