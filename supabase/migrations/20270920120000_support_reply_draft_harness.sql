-- CS agent harness: staff-facing reason + order/ticket citations on cached drafts.
-- Help slugs stay in cited_help_slugs. Review-before-send is unchanged.

ALTER TABLE public.support_reply_drafts
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.support_reply_drafts.reason IS
  'Short staff-facing why this suggested reply. Never sent to the customer.';

COMMENT ON COLUMN public.support_reply_drafts.citations IS
  'Order and ticket citations used to ground the draft. Help slugs stay in cited_help_slugs.';
