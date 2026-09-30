-- Move recently viewed retention out of the listing-view request path.
-- The existing (user_id, viewed_at DESC) index supports the retention ranking.

CREATE OR REPLACE FUNCTION public.record_user_listing_view(
  p_user_id uuid,
  p_listing_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_listing_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_user_listing_view(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_listing_view(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.record_user_listing_view(uuid, uuid) IS
  'Records a signed-in listing detail view: upserts viewed_at and increments view_count. Retention is asynchronous.';

CREATE OR REPLACE FUNCTION public.trim_user_recently_viewed_listings(
  p_keep_rows integer DEFAULT 100,
  p_delete_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_keep_rows < 1 OR p_keep_rows > 1000 THEN
    RAISE EXCEPTION 'p_keep_rows must be between 1 and 1000';
  END IF;

  IF p_delete_limit < 1 OR p_delete_limit > 5000 THEN
    RAISE EXCEPTION 'p_delete_limit must be between 1 and 5000';
  END IF;

  WITH ranked AS MATERIALIZED (
    SELECT
      user_id,
      listing_id,
      viewed_at,
      row_number() OVER (
        PARTITION BY user_id
        ORDER BY viewed_at DESC, listing_id DESC
      ) AS retention_rank
    FROM public.user_recently_viewed_listings
  ),
  stale AS (
    SELECT user_id, listing_id, viewed_at
    FROM ranked
    WHERE retention_rank > p_keep_rows
    ORDER BY user_id, retention_rank DESC
    LIMIT p_delete_limit
  ),
  deleted AS (
    DELETE FROM public.user_recently_viewed_listings target
    USING stale
    WHERE target.user_id = stale.user_id
      AND target.listing_id = stale.listing_id
      AND target.viewed_at = stale.viewed_at
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted
  FROM deleted;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.trim_user_recently_viewed_listings(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trim_user_recently_viewed_listings(integer, integer)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trim_user_recently_viewed_listings(integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.trim_user_recently_viewed_listings(integer, integer) IS
  'Deletes one bounded batch beyond each user''s recently viewed retention cap. Service role only and safe to retry.';
