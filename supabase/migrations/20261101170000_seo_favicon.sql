-- Site-wide favicon / app icon, uploaded from the admin SEO panel (Crawling tab).
-- Stored on the singleton seo_settings row and emitted as <link rel="icon"> from the root layout.

ALTER TABLE public.seo_settings
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS apple_icon_url text;

-- Allow SVG + ICO favicons in the existing public SEO assets bucket (idempotent).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'
]::text[]
WHERE id = 'seo-assets';
