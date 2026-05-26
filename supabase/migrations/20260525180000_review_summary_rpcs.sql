-- PDP review summaries: avg + count in one SQL round-trip (avoids fetching all rating rows).

CREATE OR REPLACE FUNCTION public.seller_review_summary(p_reviewed_id uuid)
RETURNS TABLE (avg_rating double precision, review_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    coalesce(avg(r.rating), 0)::double precision,
    count(*)::bigint
  FROM public.reviews r
  WHERE r.reviewed_id = p_reviewed_id;
$$;

CREATE OR REPLACE FUNCTION public.reswell_platform_review_summary()
RETURNS TABLE (avg_rating double precision, review_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    coalesce(avg(r.rating), 0)::double precision,
    count(*)::bigint
  FROM public.reswell_platform_reviews r;
$$;

GRANT EXECUTE ON FUNCTION public.seller_review_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reswell_platform_review_summary() TO anon, authenticated;
