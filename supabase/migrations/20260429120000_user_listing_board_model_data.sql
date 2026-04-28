-- Aggregate surfboard listing field snapshots for admins to reconcile into catalog (brand_models / brand_model_variants).

CREATE TABLE IF NOT EXISTS public.user_listing_board_model_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings (id) ON DELETE CASCADE,
  listing_url text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  catalog_brand_slug text,
  catalog_model_slug text,
  model_name text,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  dimensions text NOT NULL DEFAULT '',
  length_label text,
  width_label text,
  thickness_label text,
  volume_label text,
  condition text NOT NULL,
  listing_price numeric(10, 2) NOT NULL,
  fins_setup text,
  sold_price numeric(10, 2),
  sold_at timestamptz,
  converted_brand_model_variant_id uuid REFERENCES public.brand_model_variants (id) ON DELETE SET NULL,
  converted_at timestamptz,
  dismissed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_listing_board_model_data_condition_check CHECK (
    condition IN ('brand_new', 'excellent', 'very_good', 'good', 'fair', 'poor')
  ),
  CONSTRAINT user_listing_board_model_data_listing_url_path_check CHECK (
    length(trim(listing_url)) > 1
    AND left(trim(listing_url), 3) = '/l/'
    AND length(listing_url) <= 2048
  )
);

CREATE INDEX IF NOT EXISTS user_listing_board_model_data_brand_id_idx
  ON public.user_listing_board_model_data (brand_id);

CREATE INDEX IF NOT EXISTS user_listing_board_model_data_pending_idx
  ON public.user_listing_board_model_data (converted_at, dismissed_at)
  WHERE converted_at IS NULL AND dismissed_at IS NULL;

COMMENT ON TABLE public.user_listing_board_model_data IS
  'Snapshots surfboard marketplace listings for admins to vet and merge into brand_model_variants.';

COMMENT ON COLUMN public.user_listing_board_model_data.listing_url IS
  'Canonical app path for the listing detail page at snapshot time (e.g. /l/my-board slug or /l/uuid fallback).';

COMMENT ON COLUMN public.user_listing_board_model_data.dimensions IS
  'Human-readable summary (length × width × thick — vol); label columns duplicate for variant prefill.';
COMMENT ON COLUMN public.user_listing_board_model_data.sold_price IS
  'Buyer-facing order total in USD when the listing sold.';
COMMENT ON COLUMN public.user_listing_board_model_data.converted_brand_model_variant_id IS
  'Set when an admin publishes this snapshot into catalog variants.';

ALTER TABLE public.user_listing_board_model_data ENABLE ROW LEVEL SECURITY;

-- Catalog data is reviewed by admins only.
DROP POLICY IF EXISTS "user_listing_board_model_data_select_admin"
  ON public.user_listing_board_model_data;
CREATE POLICY "user_listing_board_model_data_select_admin"
  ON public.user_listing_board_model_data FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Sellers snapshot their listings; admins may upsert on behalf (impersonation / support).
DROP POLICY IF EXISTS "user_listing_board_model_data_insert_own"
  ON public.user_listing_board_model_data;
CREATE POLICY "user_listing_board_model_data_insert_eligible"
  ON public.user_listing_board_model_data FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = user_listing_board_model_data.user_id
    )
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = true
      )
    )
  );

DROP POLICY IF EXISTS "user_listing_board_model_data_update_own_or_admin"
  ON public.user_listing_board_model_data;
CREATE POLICY "user_listing_board_model_data_update_own_or_admin"
  ON public.user_listing_board_model_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
