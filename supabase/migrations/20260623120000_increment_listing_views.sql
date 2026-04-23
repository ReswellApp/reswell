-- Public listing page views: sellers see counts on /dashboard/listings.
-- RLS only allows owners to UPDATE listings, so a definer function increments `views` safely.

CREATE OR REPLACE FUNCTION public.increment_listing_views(
  p_listing_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings l
  SET views = coalesce(l.views, 0) + 1
  WHERE l.id = p_listing_id
    AND l.archived_at IS NULL
    AND l.status IN ('active', 'sold', 'pending', 'pending_sale')
    AND (p_viewer_id IS NULL OR l.user_id IS DISTINCT FROM p_viewer_id);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_listing_views(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.increment_listing_views(uuid, uuid) IS
  'Increments listing.views for browseable rows; skips seller self-views and draft/removed/archived.';
