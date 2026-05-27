-- Forum comment image attachments (metadata JSONB + storage bucket).
-- Run in Supabase SQL editor, then reload API schema.

ALTER TABLE public.forum_comments
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.forum_comments.metadata IS
  'Optional structured payload (e.g. image attachment). Plain body remains for search/accessibility.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-attachments',
  'forum-attachments',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "forum_attachments_insert_auth" ON storage.objects;
CREATE POLICY "forum_attachments_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'forum-attachments'
    AND EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id::text = split_part(name, '/', 1)
    )
  );
