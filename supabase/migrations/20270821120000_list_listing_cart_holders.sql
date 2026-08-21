-- Seller-only: who has this listing in cart (public names only — no email).
-- Also expand cart-count RPCs from surfboards-only to all peer marketplace sections
-- so sellers can offer on fins, wetsuits, and other cart-eligible listings.

CREATE OR REPLACE FUNCTION public.list_listing_cart_holders(p_listing_id uuid)
RETURNS TABLE (
  buyer_id uuid,
  display_name text,
  shop_name text,
  is_shop boolean,
  avatar_url text,
  added_at timestamptz,
  open_offer_id uuid,
  conversation_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.id = p_listing_id
      AND l.user_id = auth.uid()
      AND l.archived_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ci.profile_id AS buyer_id,
    p.display_name,
    p.shop_name,
    coalesce(p.is_shop, false) AS is_shop,
    p.avatar_url,
    ci.created_at AS added_at,
    open_offer.id AS open_offer_id,
    thread.id AS conversation_id
  FROM public.cart_items ci
  INNER JOIN public.listings l ON l.id = ci.listing_id
  LEFT JOIN public.profiles p ON p.id = ci.profile_id
  LEFT JOIN LATERAL (
    SELECT o.id
    FROM public.offers o
    WHERE o.buyer_id = ci.profile_id
      AND o.status IN ('PENDING', 'COUNTERED')
      AND (
        o.listing_id = p_listing_id
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(o.line_items, '[]'::jsonb)) AS li
          WHERE li->>'listing_id' = p_listing_id::text
        )
      )
    ORDER BY o.created_at DESC
    LIMIT 1
  ) open_offer ON true
  LEFT JOIN LATERAL (
    SELECT c.id
    FROM public.conversations c
    WHERE c.buyer_id = ci.profile_id
      AND c.seller_id = l.user_id
      AND c.listing_id = p_listing_id
    LIMIT 1
  ) thread ON true
  WHERE ci.listing_id = p_listing_id
    AND ci.profile_id IS DISTINCT FROM l.user_id
    AND coalesce(l.hidden_from_site, false) = false
    AND l.section IN (
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories',
      'magazines'
    )
    AND l.archived_at IS NULL
    AND l.status IN ('active', 'pending_sale')
    AND (
      l.local_pickup IS DISTINCT FROM false
      OR coalesce(l.shipping_available, false) = true
    )
  ORDER BY ci.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_listing_cart_holders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_listing_cart_holders(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_listing_cart_holders(uuid) IS
  'Listing owner only: buyers who have this listing in cart, plus any open offer/thread.';

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
    AND ci.profile_id IS DISTINCT FROM l.user_id
    AND coalesce(l.hidden_from_site, false) = false
    AND l.section IN (
      'surfboards',
      'fins',
      'wetsuits',
      'boardbags',
      'surfpacks',
      'leashes',
      'apparel',
      'accessories',
      'magazines'
    )
    AND l.archived_at IS NULL
    AND l.status IN ('active', 'pending_sale')
    AND (
      l.local_pickup IS DISTINCT FROM false
      OR coalesce(l.shipping_available, false) = true
    );
$$;

COMMENT ON FUNCTION public.count_listing_cart_holders(uuid) IS
  'Returns buyer cart rows for a peer listing matching current add-to-cart rules (public aggregate).';

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
      AND cl.section IN (
        'surfboards',
        'fins',
        'wetsuits',
        'boardbags',
        'surfpacks',
        'leashes',
        'apparel',
        'accessories',
        'magazines'
      )
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
        AND l.section IN (
          'surfboards',
          'fins',
          'wetsuits',
          'boardbags',
          'surfpacks',
          'leashes',
          'apparel',
          'accessories',
          'magazines'
        )
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
