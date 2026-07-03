-- Partner sites embed Reswell surfboard listings via iframe (/embed/listings/:slug).

CREATE TABLE IF NOT EXISTS public.partner_listing_embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  partner_label text,
  headline text NOT NULL DEFAULT 'Used surfboards for sale.',
  subheadline text NOT NULL DEFAULT 'Shop boards listed by local surfers along the coast.',
  cta_primary text NOT NULL DEFAULT 'Browse on Reswell',
  cta_secondary text NOT NULL DEFAULT 'View all boards →',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_listing_embeds_slug_unique UNIQUE (slug),
  CONSTRAINT partner_listing_embeds_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS partner_listing_embeds_active_idx
  ON public.partner_listing_embeds (is_active, slug);

CREATE TABLE IF NOT EXISTS public.partner_listing_embed_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embed_id uuid NOT NULL REFERENCES public.partner_listing_embeds(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_listing_embed_listings_unique UNIQUE (embed_id, listing_id)
);

CREATE INDEX IF NOT EXISTS partner_listing_embed_listings_embed_sort_idx
  ON public.partner_listing_embed_listings (embed_id, sort_order, created_at);

ALTER TABLE public.partner_listing_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_listing_embed_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_listing_embeds_select_public" ON public.partner_listing_embeds;
CREATE POLICY "partner_listing_embeds_select_public" ON public.partner_listing_embeds
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "partner_listing_embeds_select_admin" ON public.partner_listing_embeds;
CREATE POLICY "partner_listing_embeds_select_admin" ON public.partner_listing_embeds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embeds_insert_admin" ON public.partner_listing_embeds;
CREATE POLICY "partner_listing_embeds_insert_admin" ON public.partner_listing_embeds
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embeds_update_admin" ON public.partner_listing_embeds;
CREATE POLICY "partner_listing_embeds_update_admin" ON public.partner_listing_embeds
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embeds_delete_admin" ON public.partner_listing_embeds;
CREATE POLICY "partner_listing_embeds_delete_admin" ON public.partner_listing_embeds
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embed_listings_select_public" ON public.partner_listing_embed_listings;
CREATE POLICY "partner_listing_embed_listings_select_public" ON public.partner_listing_embed_listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partner_listing_embeds e
      WHERE e.id = embed_id AND e.is_active = true
    )
  );

DROP POLICY IF EXISTS "partner_listing_embed_listings_select_admin" ON public.partner_listing_embed_listings;
CREATE POLICY "partner_listing_embed_listings_select_admin" ON public.partner_listing_embed_listings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embed_listings_insert_admin" ON public.partner_listing_embed_listings;
CREATE POLICY "partner_listing_embed_listings_insert_admin" ON public.partner_listing_embed_listings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embed_listings_update_admin" ON public.partner_listing_embed_listings;
CREATE POLICY "partner_listing_embed_listings_update_admin" ON public.partner_listing_embed_listings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "partner_listing_embed_listings_delete_admin" ON public.partner_listing_embed_listings;
CREATE POLICY "partner_listing_embed_listings_delete_admin" ON public.partner_listing_embed_listings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
