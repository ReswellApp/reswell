-- Seller dashboard: per-listing cart + favorite counts for /dashboard/listings filters and row metrics.
-- SECURITY DEFINER so counts across buyers are visible despite RLS on cart_items / favorites.

CREATE OR REPLACE FUNCTION public.get_my_listings_engagement_counts()
RETURNS TABLE (
  listing_id uuid,
  cart_count bigint,
  favorite_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS listing_id,
    coalesce(cart_counts.cnt, 0)::bigint AS cart_count,
    coalesce(fav_counts.cnt, 0)::bigint AS favorite_count
  FROM public.listings l
  LEFT JOIN (
    SELECT ci.listing_id, count(*) AS cnt
    FROM public.cart_items ci
    INNER JOIN public.listings cl ON cl.id = ci.listing_id
    WHERE coalesce(cl.hidden_from_site, false) = false
      AND cl.section = 'surfboards'
      AND cl.archived_at IS NULL
      AND cl.status IN ('active', 'pending_sale')
      AND (
        cl.local_pickup IS DISTINCT FROM false
        OR coalesce(cl.shipping_available, false) = true
      )
    GROUP BY ci.listing_id
  ) cart_counts ON cart_counts.listing_id = l.id
  LEFT JOIN (
    SELECT f.listing_id, count(*) AS cnt
    FROM public.favorites f
    GROUP BY f.listing_id
  ) fav_counts ON fav_counts.listing_id = l.id
  WHERE l.user_id = auth.uid()
    AND l.archived_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_listings_engagement_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_listings_engagement_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_listings_engagement_counts() TO service_role;

COMMENT ON FUNCTION public.get_my_listings_engagement_counts() IS
  'Dashboard listings page: per-listing cart and favorite counts for the current seller.';
