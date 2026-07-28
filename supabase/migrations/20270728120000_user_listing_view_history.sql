-- Per-user listing view history: view counts + first/last viewed for engagement + admin.
-- Also make increment_listing_views report whether a public view was counted (skip seller self-views).

ALTER TABLE public.user_recently_viewed_listings
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz NOT NULL DEFAULT NOW();

-- Existing rows received DEFAULT now() on add; align first_viewed_at to last known viewed_at.
UPDATE public.user_recently_viewed_listings
SET first_viewed_at = viewed_at;

ALTER TABLE public.user_recently_viewed_listings
  DROP CONSTRAINT IF EXISTS user_recently_viewed_listings_view_count_positive;
ALTER TABLE public.user_recently_viewed_listings
  ADD CONSTRAINT user_recently_viewed_listings_view_count_positive
  CHECK (view_count >= 1);

CREATE INDEX IF NOT EXISTS user_recently_viewed_listings_listing_viewed_idx
  ON public.user_recently_viewed_listings (listing_id, viewed_at DESC);

COMMENT ON COLUMN public.user_recently_viewed_listings.view_count IS
  'How many times this signed-in user viewed the listing detail page.';
COMMENT ON COLUMN public.user_recently_viewed_listings.first_viewed_at IS
  'First time this signed-in user viewed the listing (not refreshed on repeat views).';
COMMENT ON COLUMN public.user_recently_viewed_listings.viewed_at IS
  'Most recent view timestamp for this user + listing.';

-- Upsert + increment view_count; trim to 100 rows per user (newest viewed_at kept).
CREATE OR REPLACE FUNCTION public.record_user_listing_view(
  p_user_id uuid,
  p_listing_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer := 100;
BEGIN
  IF p_user_id IS NULL OR p_listing_id IS NULL THEN
    RETURN;
  END IF;

  -- Session clients may only record for themselves; service_role bypasses auth.uid().
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.user_recently_viewed_listings (
    user_id,
    listing_id,
    viewed_at,
    first_viewed_at,
    view_count
  )
  VALUES (
    p_user_id,
    p_listing_id,
    NOW(),
    NOW(),
    1
  )
  ON CONFLICT (user_id, listing_id) DO UPDATE
  SET
    viewed_at = NOW(),
    view_count = public.user_recently_viewed_listings.view_count + 1;

  DELETE FROM public.user_recently_viewed_listings urv
  WHERE urv.user_id = p_user_id
    AND urv.listing_id IN (
      SELECT listing_id
      FROM public.user_recently_viewed_listings
      WHERE user_id = p_user_id
      ORDER BY viewed_at DESC
      OFFSET v_cap
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_listing_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_user_listing_view(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_listing_view(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.record_user_listing_view(uuid, uuid) IS
  'Records a signed-in listing detail view: upserts viewed_at, increments view_count, trims to 100 rows.';

-- Return whether listings.views was incremented (false for seller self-views / non-countable rows).
-- Must DROP: Postgres cannot change an existing function's return type (void → boolean) via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.increment_listing_views(uuid, uuid);

CREATE FUNCTION public.increment_listing_views(
  p_listing_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.listings l
  SET views = coalesce(l.views, 0) + 1
  WHERE l.id = p_listing_id
    AND l.archived_at IS NULL
    AND l.status IN ('active', 'sold', 'pending', 'pending_sale')
    AND (p_viewer_id IS NULL OR l.user_id IS DISTINCT FROM p_viewer_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_listing_views(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.increment_listing_views(uuid, uuid) IS
  'Increments listing.views for browseable rows; skips seller self-views and draft/removed/archived. Returns true when a view was counted.';
