-- Public aggregate: how many distinct buyers have this listing in cart (surfboards only,
-- same eligibility as add-to-cart). RLS hides cart_rows from other users, so a definer
-- function returns only the count.

CREATE OR REPLACE FUNCTION public.count_listing_cart_holders(p_listing_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.cart_items ci
  INNER JOIN public.listings l ON l.id = ci.listing_id
  WHERE ci.listing_id = p_listing_id
    AND coalesce(l.hidden_from_site, false) = false
    AND l.section = 'surfboards'
    AND l.archived_at IS NULL
    AND l.status IN ('active', 'pending_sale')
    AND (
      l.local_pickup IS DISTINCT FROM false
      OR coalesce(l.shipping_available, false) = true
    );
$$;

REVOKE ALL ON FUNCTION public.count_listing_cart_holders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_listing_cart_holders(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.count_listing_cart_holders(uuid) IS
  'Returns buyer cart rows for a listing matching current add-to-cart rules (public aggregate).';
