-- Surfers: Instagram + YouTube links (replaces legacy website_url if it existed).

ALTER TABLE public.surfers ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE public.surfers ADD COLUMN IF NOT EXISTS youtube_url text;

ALTER TABLE public.surfers DROP COLUMN IF EXISTS website_url;
