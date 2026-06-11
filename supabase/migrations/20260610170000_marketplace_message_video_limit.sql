-- Raise marketplace DM attachment limit to 500MB so users can send
-- up to ~2 minutes of high-bitrate (untranscoded) phone video.
-- NOTE: the project-wide "global file size limit" in Supabase dashboard
-- (Storage settings) must also be >= 500MB for this to take effect.

UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'marketplace-message-attachments';
