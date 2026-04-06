-- Draft listings for sell-flow preview: not visible to the public, only to the owner.
-- Run in Supabase SQL editor or your migration runner.

-- 1) Allow `draft` (and `pending_sale` if missing) on listings.status
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'active'::text,
        'sold'::text,
        'pending'::text,
        'removed'::text,
        'draft'::text,
        'pending_sale'::text
      ]
    )
  );

-- 2) Hide drafts from anonymous/other users; everyone can still read non-draft rows
DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
CREATE POLICY "listings_select_public" ON public.listings
  FOR SELECT
  USING (
    (status IS DISTINCT FROM 'draft')
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );
