-- Persist TypeSafe Jev post-vision verification for dimension-photo matches.
-- Jev never sees images; it verifies / routes after Gemini and stores soft
-- rating hints for the admin library (photo/dims verdicts, volume clear, etc.).

ALTER TABLE public.surfboard_dimension_photo_matches
  ADD COLUMN IF NOT EXISTS jev_review jsonb;

COMMENT ON COLUMN public.surfboard_dimension_photo_matches.jev_review IS
  'Jev post-vision verify payload: photo/dims verdicts, volume clear, next action, reason. Soft hints for admin rating — never auto-applies Good/Bad.';

CREATE INDEX IF NOT EXISTS surfboard_dimension_photo_matches_jev_low_confidence_idx
  ON public.surfboard_dimension_photo_matches (occurred_at DESC)
  WHERE predicted_confidence = 'low';
