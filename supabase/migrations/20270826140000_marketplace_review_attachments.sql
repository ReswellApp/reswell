-- Optional photos on marketplace user reviews (buyer→seller and seller→buyer).

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.reviews.metadata IS
  'Optional structured payload (e.g. image attachments).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-review-attachments',
  'marketplace-review-attachments',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "marketplace_review_attachments_insert_own" ON storage.objects;
CREATE POLICY "marketplace_review_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-review-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
