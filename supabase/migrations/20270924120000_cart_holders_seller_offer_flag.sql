-- Expose whether a cart holder's open offer was sent by the seller,
-- so the listing owner can update or revoke it without treating a buyer offer the same way.

DROP FUNCTION IF EXISTS public.list_listing_cart_holders(uuid);

CREATE FUNCTION public.list_listing_cart_holders(p_listing_id uuid)
RETURNS TABLE (
  buyer_id uuid,
  display_name text,
  shop_name text,
  is_shop boolean,
  avatar_url text,
  added_at timestamptz,
  open_offer_id uuid,
  open_offer_seller_initiated boolean,
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
    coalesce(open_offer.seller_initiated, false) AS open_offer_seller_initiated,
    thread.id AS conversation_id
  FROM public.cart_items ci
  INNER JOIN public.listings l ON l.id = ci.listing_id
  LEFT JOIN public.profiles p ON p.id = ci.profile_id
  LEFT JOIN LATERAL (
    SELECT o.id, o.seller_initiated
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
