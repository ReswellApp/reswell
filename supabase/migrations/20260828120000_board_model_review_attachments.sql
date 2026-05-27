-- Optional photo attachments on board model reviews (metadata JSONB + storage bucket).

ALTER TABLE public.board_model_reviews
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.board_model_reviews.metadata IS
  'Optional structured payload (e.g. image attachment).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-review-attachments',
  'board-review-attachments',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "board_review_attachments_insert_own" ON storage.objects;
CREATE POLICY "board_review_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'board-review-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
