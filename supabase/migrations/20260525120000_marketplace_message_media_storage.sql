-- Extend marketplace DM attachments bucket for user-uploaded photos and videos.

UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
WHERE id = 'marketplace-message-attachments';

DROP POLICY IF EXISTS "marketplace_message_attachments_insert_participants" ON storage.objects;
CREATE POLICY "marketplace_message_attachments_insert_participants"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
