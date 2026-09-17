-- Staff coaching notes on rated reply examples (why very_good / okay / bad).

ALTER TABLE public.support_reply_examples
  ADD COLUMN IF NOT EXISTS rating_note text;

COMMENT ON COLUMN public.support_reply_examples.rating_note IS
  'Optional free-form coach note explaining the rating; used as few-shot learning signal.';
