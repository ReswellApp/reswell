-- Replace section-only created_at indexes with public-browse partials that match
-- the real peer/shop browse predicates:
--   status = 'active'
--   hidden_from_site = false
--   archived_at IS NULL
--
-- Default browse sort is created_at DESC. As sold/hidden/archived rows accumulate,
-- these keep /boards, /fins, /apparel, etc. from scanning non-discoverable rows.

BEGIN;

-- Drop weaker section-only created_at indexes (superseded below).
DROP INDEX IF EXISTS public.listings_fins_section_created_idx;
DROP INDEX IF EXISTS public.listings_wetsuits_section_created_idx;
DROP INDEX IF EXISTS public.listings_boardbags_section_created_idx;
DROP INDEX IF EXISTS public.listings_surfpacks_section_created_idx;
DROP INDEX IF EXISTS public.listings_leashes_section_created_idx;
DROP INDEX IF EXISTS public.listings_apparel_section_created_idx;
DROP INDEX IF EXISTS public.listings_accessories_section_created_idx;
DROP INDEX IF EXISTS public.listings_magazines_section_created_idx;

-- Peer marketplace + shop public browse (newest-first).
CREATE INDEX IF NOT EXISTS listings_surfboards_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'surfboards'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_fins_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'fins'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_wetsuits_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'wetsuits'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_boardbags_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'boardbags'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_surfpacks_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'surfpacks'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_leashes_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'leashes'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_apparel_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'apparel'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_accessories_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'accessories'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_magazines_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'magazines'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS listings_new_public_browse_created_idx
  ON public.listings (created_at DESC)
  WHERE section = 'new'
    AND status = 'active'
    AND hidden_from_site = false
    AND archived_at IS NULL;

COMMIT;
