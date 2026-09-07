-- Images dropped into Reswell ticket descriptions. Staff-only writes; public read for previews.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reswell-ticket-images',
  'reswell-ticket-images',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reswell_ticket_images_select_public" ON storage.objects;
CREATE POLICY "reswell_ticket_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reswell-ticket-images');

DROP POLICY IF EXISTS "reswell_ticket_images_insert_staff" ON storage.objects;
CREATE POLICY "reswell_ticket_images_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reswell-ticket-images'
    AND public.is_admin_or_employee()
  );

DROP POLICY IF EXISTS "reswell_ticket_images_delete_staff" ON storage.objects;
CREATE POLICY "reswell_ticket_images_delete_staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reswell-ticket-images'
    AND public.is_admin_or_employee()
  );
