-- Add archived_at for soft-delete / 30-day retention
-- Run in Supabase SQL Editor: Dashboard -> SQL Editor -> New query

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.listings.archived_at IS 'When set, listing is archived; purge after 30 days';

CREATE INDEX IF NOT EXISTS idx_listings_archived_at ON public.listings(archived_at) WHERE archived_at IS NOT NULL;
