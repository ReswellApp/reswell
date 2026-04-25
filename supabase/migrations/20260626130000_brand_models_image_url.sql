-- Public image URL for each board model (Supabase Storage or CDN), same pattern as brands.logo_url.

ALTER TABLE public.brand_models
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.brand_models.image_url IS 'Optional hero/reference image; typically brand-assets/board-models/* in Storage.';
