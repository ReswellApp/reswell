-- Reswell Price Guide: editorial overlay on computed marketplace pricing.
-- Public pages still render from listings/orders when no entry exists.

CREATE TABLE IF NOT EXISTS public.price_guide_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT NOT NULL,
  brand_id UUID REFERENCES public.brands (id) ON DELETE CASCADE,
  brand_model_id UUID REFERENCES public.brand_models (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pricing_source TEXT NOT NULL DEFAULT 'mixed'
    CHECK (pricing_source IN ('market', 'editorial', 'mixed')),
  typical_low_usd NUMERIC(10, 2),
  typical_mid_usd NUMERIC(10, 2),
  typical_high_usd NUMERIC(10, 2),
  new_retail_usd NUMERIC(10, 2),
  condition_bands JSONB NOT NULL DEFAULT '[]'::jsonb,
  headline TEXT,
  summary TEXT,
  body TEXT,
  confidence TEXT
    CHECK (confidence IS NULL OR confidence IN ('thin', 'emerging', 'solid', 'expert')),
  notes_internal TEXT,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT price_guide_entries_model_needs_brand
    CHECK (brand_model_id IS NULL OR brand_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS price_guide_entries_scope_uidx
  ON public.price_guide_entries (
    category_slug,
    COALESCE(brand_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(brand_model_id, '00000000-0000-0000-0000-000000000000')
  );

CREATE INDEX IF NOT EXISTS price_guide_entries_status_featured_idx
  ON public.price_guide_entries (status, featured, sort_order);

CREATE INDEX IF NOT EXISTS price_guide_entries_brand_idx
  ON public.price_guide_entries (brand_id)
  WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS price_guide_entries_model_idx
  ON public.price_guide_entries (brand_model_id)
  WHERE brand_model_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.price_guide_manual_comps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.price_guide_entries (id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings (id) ON DELETE SET NULL,
  sold_price_usd NUMERIC(10, 2) NOT NULL,
  sold_at DATE NOT NULL,
  condition TEXT,
  dimensions TEXT,
  title TEXT,
  source TEXT NOT NULL DEFAULT 'other'
    CHECK (source IN ('reswell', 'fb_marketplace', 'craigslist', 'ebay', 'shop', 'other')),
  source_url TEXT,
  notes TEXT,
  include_in_public BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_guide_manual_comps_entry_idx
  ON public.price_guide_manual_comps (entry_id, sold_at DESC);

ALTER TABLE public.price_guide_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_guide_manual_comps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_guide_entries_select_published" ON public.price_guide_entries;
CREATE POLICY "price_guide_entries_select_published" ON public.price_guide_entries
  FOR SELECT USING (
    status = 'published'
    OR public.is_admin_or_employee()
  );

DROP POLICY IF EXISTS "price_guide_entries_write_staff" ON public.price_guide_entries;
CREATE POLICY "price_guide_entries_write_staff" ON public.price_guide_entries
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "price_guide_entries_update_staff" ON public.price_guide_entries;
CREATE POLICY "price_guide_entries_update_staff" ON public.price_guide_entries
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "price_guide_entries_delete_staff" ON public.price_guide_entries;
CREATE POLICY "price_guide_entries_delete_staff" ON public.price_guide_entries
  FOR DELETE USING (public.is_admin_or_employee());

DROP POLICY IF EXISTS "price_guide_manual_comps_select_public" ON public.price_guide_manual_comps;
CREATE POLICY "price_guide_manual_comps_select_public" ON public.price_guide_manual_comps
  FOR SELECT USING (
    public.is_admin_or_employee()
    OR (
      include_in_public = true
      AND EXISTS (
        SELECT 1
        FROM public.price_guide_entries e
        WHERE e.id = price_guide_manual_comps.entry_id
          AND e.status = 'published'
      )
    )
  );

DROP POLICY IF EXISTS "price_guide_manual_comps_insert_staff" ON public.price_guide_manual_comps;
CREATE POLICY "price_guide_manual_comps_insert_staff" ON public.price_guide_manual_comps
  FOR INSERT WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "price_guide_manual_comps_update_staff" ON public.price_guide_manual_comps;
CREATE POLICY "price_guide_manual_comps_update_staff" ON public.price_guide_manual_comps
  FOR UPDATE
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "price_guide_manual_comps_delete_staff" ON public.price_guide_manual_comps;
CREATE POLICY "price_guide_manual_comps_delete_staff" ON public.price_guide_manual_comps
  FOR DELETE USING (public.is_admin_or_employee());

COMMENT ON TABLE public.price_guide_entries IS
  'Editorial price-guide overlay for a category, brand, or catalog model. Market stats are computed from listings and orders.';
COMMENT ON TABLE public.price_guide_manual_comps IS
  'Admin-entered sold comps (Reswell, FB, Craigslist, shops) attached to a price guide entry.';
