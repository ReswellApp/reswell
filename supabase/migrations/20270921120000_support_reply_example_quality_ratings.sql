-- Unify example ratings to a quality scale: very_good / okay / bad.
-- accepted → very_good, edited → okay, rejected → bad.

ALTER TABLE public.support_reply_examples
  DROP CONSTRAINT IF EXISTS support_reply_examples_rating_check;

UPDATE public.support_reply_examples
SET rating = CASE rating
  WHEN 'accepted' THEN 'very_good'
  WHEN 'edited' THEN 'okay'
  WHEN 'rejected' THEN 'bad'
  ELSE rating
END
WHERE rating IN ('accepted', 'edited', 'rejected');

ALTER TABLE public.support_reply_examples
  ADD CONSTRAINT support_reply_examples_rating_check
  CHECK (rating IN ('very_good', 'okay', 'bad'));

COMMENT ON COLUMN public.support_reply_examples.rating IS
  'Quality of the stored reply: very_good (shipped as-is or marked great), okay (edited or usable), bad (ignored at retrieval).';
