-- Public aggregate: how many users saved this listing. RLS only allows users to
-- SELECT their own favorites rows, so a definer function returns only the count.

CREATE OR REPLACE FUNCTION public.count_listing_favorites(p_listing_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.favorites f
  WHERE f.listing_id = p_listing_id;
$$;

REVOKE ALL ON FUNCTION public.count_listing_favorites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_listing_favorites(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.count_listing_favorites(uuid) IS
  'Returns number of users who favorited a listing (public aggregate).';
