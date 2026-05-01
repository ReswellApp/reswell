-- Private PDF storage for marketplace DM attachments (admin upload via service role; participants read via RLS).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-message-attachments',
  'marketplace-message-attachments',
  false,
  12582912,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "marketplace_message_attachments_select_participants" ON storage.objects;
CREATE POLICY "marketplace_message_attachments_select_participants"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketplace-message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Inserts use the service role (no authenticated INSERT policy).
