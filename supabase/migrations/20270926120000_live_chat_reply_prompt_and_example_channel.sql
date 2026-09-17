-- Live chat CS-agent prompt (editable on /admin/support-reply-examples)
-- plus channel tagging on reply examples so live-chat ratings feed the learning loop.

ALTER TABLE public.support_reply_root_prompt
  DROP CONSTRAINT IF EXISTS support_reply_root_prompt_singleton;

ALTER TABLE public.support_reply_root_prompt
  ADD CONSTRAINT support_reply_root_prompt_known_ids
  CHECK (id IN ('global', 'live_chat'));

COMMENT ON TABLE public.support_reply_root_prompt IS
  'Root prompts for the CS agent: id=global (inbox drafts) and id=live_chat (auto-sent live chat replies).';

INSERT INTO public.support_reply_root_prompt (id, body)
VALUES ('live_chat', '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.support_reply_examples
  ADD COLUMN IF NOT EXISTS source_channel text;

COMMENT ON COLUMN public.support_reply_examples.source_channel IS
  'Optional channel tag (e.g. live_chat) so retrieval and admin filters can prefer channel-matched examples.';

CREATE INDEX IF NOT EXISTS support_reply_examples_source_channel_created_idx
  ON public.support_reply_examples (source_channel, created_at DESC);
