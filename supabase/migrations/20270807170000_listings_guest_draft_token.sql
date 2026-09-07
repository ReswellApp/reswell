-- Phase 0.2: guest server drafts on listings (status = draft).
-- Ownership for unsigned sellers is a hashed httpOnly cookie token.
-- Tightens SELECT so draft rows are not world-readable.

ALTER TABLE public.listings
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS guest_token_hash text;

COMMENT ON COLUMN public.listings.guest_token_hash IS
  'SHA-256 hex of guest draft cookie. Set only while user_id IS NULL and status = draft.';

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_guest_draft_owner_chk;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_guest_draft_owner_chk
  CHECK (
    (
      user_id IS NOT NULL
      AND guest_token_hash IS NULL
    )
    OR (
      user_id IS NULL
      AND status = 'draft'
      AND guest_token_hash IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS listings_guest_token_hash_draft_idx
  ON public.listings (guest_token_hash)
  WHERE status = 'draft' AND guest_token_hash IS NOT NULL;

-- Drafts are owner/staff only. Non-draft rows stay publicly selectable (browse/detail).
DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
CREATE POLICY "listings_select_public" ON public.listings
  FOR SELECT
  USING (
    status IS DISTINCT FROM 'draft'
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
    )
  );

DROP POLICY IF EXISTS "listing_images_select_public" ON public.listing_images;
CREATE POLICY "listing_images_select_public" ON public.listing_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND (
          l.status IS DISTINCT FROM 'draft'
          OR l.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
          )
        )
    )
  );
