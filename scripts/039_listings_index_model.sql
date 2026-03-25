-- Link surfboard listings to the brand directory (optional).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS index_brand_slug TEXT,
  ADD COLUMN IF NOT EXISTS index_model_slug TEXT,
  ADD COLUMN IF NOT EXISTS index_model_label TEXT;

COMMENT ON COLUMN public.listings.index_brand_slug IS 'Directory brand slug when seller matched listing to index (e.g. album-surf)';
COMMENT ON COLUMN public.listings.index_model_slug IS 'Directory model slug when matched (e.g. twinsman)';
COMMENT ON COLUMN public.listings.index_model_label IS 'Denormalized "Model — Brand" label for display';
