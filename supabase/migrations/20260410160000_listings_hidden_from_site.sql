-- Admin can hide listings from public discovery and URLs (row remains for orders/history).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS hidden_from_site boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.hidden_from_site IS
  'When true, listing is omitted from browse/search/feed and public /l URLs (except seller and staff).';
