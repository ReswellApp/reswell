-- Seller dashboard: aggregate listing inventory + engagement stats for /dashboard/listings.
-- SECURITY DEFINER so cart/favorite counts across the seller's listings are visible despite RLS.

CREATE OR REPLACE FUNCTION public.get_my_listings_dashboard_stats()
RETURNS TABLE (
  total_listings bigint,
  total_views bigint,
  in_carts bigint,
  saved bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT l.id, l.views
    FROM public.listings l
    WHERE l.user_id = auth.uid()
      AND l.archived_at IS NULL
  )
  SELECT
    (SELECT count(*)::bigint FROM mine) AS total_listings,
    (SELECT coalesce(sum(views), 0)::bigint FROM mine) AS total_views,
    (
      SELECT count(*)::bigint
      FROM public.cart_items ci
      INNER JOIN public.listings l ON l.id = ci.listing_id
      WHERE l.user_id = auth.uid()
        AND l.archived_at IS NULL
        AND coalesce(l.hidden_from_site, false) = false
        AND l.section = 'surfboards'
        AND l.status IN ('active', 'pending_sale')
        AND (
          l.local_pickup IS DISTINCT FROM false
          OR coalesce(l.shipping_available, false) = true
        )
    ) AS in_carts,
    (
      SELECT count(*)::bigint
      FROM public.favorites f
      INNER JOIN public.listings l ON l.id = f.listing_id
      WHERE l.user_id = auth.uid()
        AND l.archived_at IS NULL
    ) AS saved;
$$;

REVOKE ALL ON FUNCTION public.get_my_listings_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_listings_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_listings_dashboard_stats() TO service_role;

COMMENT ON FUNCTION public.get_my_listings_dashboard_stats() IS
  'Dashboard listings page: counts non-archived listings, summed views, cart rows, and favorites for the current seller.';
