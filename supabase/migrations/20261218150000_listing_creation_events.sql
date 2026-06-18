-- Immutable log of when listings were first published/created for admin analytics.
-- Survives permanent listing deletes so monthly "new listings" trends stay accurate.

CREATE TABLE IF NOT EXISTS public.listing_creation_events (
  listing_id uuid PRIMARY KEY,
  listed_at timestamptz NOT NULL,
  section text
);

CREATE INDEX IF NOT EXISTS idx_listing_creation_events_listed_at
  ON public.listing_creation_events (listed_at DESC);

COMMENT ON TABLE public.listing_creation_events IS
  'Append-only record of when a listing was first published (non-draft). Used for admin listing trend charts.';

-- Backfill from existing rows (skip in-progress drafts).
INSERT INTO public.listing_creation_events (listing_id, listed_at, section)
SELECT l.id, l.created_at, l.section
FROM public.listings l
WHERE l.status IS DISTINCT FROM 'draft'
ON CONFLICT (listing_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.log_listing_creation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      INSERT INTO public.listing_creation_events (listing_id, listed_at, section)
      VALUES (NEW.id, NEW.created_at, NEW.section)
      ON CONFLICT (listing_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'draft' AND NEW.status IS DISTINCT FROM 'draft' THEN
      INSERT INTO public.listing_creation_events (listing_id, listed_at, section)
      VALUES (NEW.id, coalesce(NEW.updated_at, now()), NEW.section)
      ON CONFLICT (listing_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_log_creation_event ON public.listings;
CREATE TRIGGER listings_log_creation_event
  AFTER INSERT OR UPDATE OF status ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_listing_creation_event();

CREATE OR REPLACE FUNCTION public.get_admin_listings_monthly_created(p_months integer DEFAULT 12)
RETURNS TABLE (
  month_key text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('month', now() AT TIME ZONE 'UTC')::date AS end_month,
      (
        date_trunc('month', now() AT TIME ZONE 'UTC')
        - ((greatest(p_months, 1) - 1) || ' months')::interval
      )::date AS start_month
  ),
  months AS (
    SELECT
      to_char(d, 'YYYY-MM') AS month_key,
      d::date AS month_start
    FROM bounds b,
      generate_series(b.start_month, b.end_month, '1 month'::interval) AS d
  ),
  counts AS (
    SELECT
      to_char(date_trunc('month', e.listed_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_key,
      count(*)::bigint AS listing_count
    FROM public.listing_creation_events e
    CROSS JOIN bounds b
    WHERE date_trunc('month', e.listed_at AT TIME ZONE 'UTC')::date >= b.start_month
      AND date_trunc('month', e.listed_at AT TIME ZONE 'UTC')::date <= b.end_month
    GROUP BY 1
  )
  SELECT m.month_key, coalesce(c.listing_count, 0)::bigint AS listing_count
  FROM months m
  LEFT JOIN counts c USING (month_key)
  ORDER BY m.month_start;
$$;

REVOKE ALL ON TABLE public.listing_creation_events FROM PUBLIC;
GRANT SELECT ON TABLE public.listing_creation_events TO service_role;

REVOKE ALL ON FUNCTION public.log_listing_creation_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_listing_creation_event() TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_listings_monthly_created(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_listings_monthly_created(integer) TO service_role;

COMMENT ON FUNCTION public.get_admin_listings_monthly_created(integer) IS
  'Admin listings page: monthly count of first-time published listings (includes sold/removed/deleted).';
