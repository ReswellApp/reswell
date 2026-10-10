-- Google Ads Shopping / free listings are Merchant Center products. Product data
-- expires 30 days after the last successful update. This table is the publish
-- clock the hourly cron uses to resubmit only listings that are due.

CREATE TABLE IF NOT EXISTS public.listing_google_merchant_publications (
  listing_id uuid PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  published_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_google_merchant_publications_last_error_length_check
    CHECK (last_error IS NULL OR char_length(last_error) <= 500)
);

COMMENT ON TABLE public.listing_google_merchant_publications IS
  'Last successful Google Merchant publish per listing. Shopping ads expire 30 days after published_at.';

COMMENT ON COLUMN public.listing_google_merchant_publications.published_at IS
  'When productInputs.insert last succeeded. Null when the listing is not currently published.';

COMMENT ON COLUMN public.listing_google_merchant_publications.last_attempt_at IS
  'Last cron or sync attempt. Failures cool down so one bad listing does not block the queue.';

COMMENT ON COLUMN public.listing_google_merchant_publications.last_error IS
  'Truncated error from the last failed publish or removal. Null after a successful publish.';

CREATE INDEX IF NOT EXISTS listing_google_merchant_publications_published_at_idx
  ON public.listing_google_merchant_publications (published_at);

ALTER TABLE public.listing_google_merchant_publications ENABLE ROW LEVEL SECURITY;

-- Service role only. No client policies.
DROP POLICY IF EXISTS "listing_google_merchant_publications_none"
  ON public.listing_google_merchant_publications;
CREATE POLICY "listing_google_merchant_publications_none"
  ON public.listing_google_merchant_publications
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Due rows match isGoogleMerchantPublicationDue in lib/google-merchant/publication.ts:
-- unpublished or published_at <= cutoff, and last attempt is outside the retry cooldown.
CREATE OR REPLACE FUNCTION public.list_due_google_merchant_listing_ids(
  p_published_before timestamptz,
  p_attempt_before timestamptz,
  p_sections text[],
  p_limit integer
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.id
  FROM public.listings l
  LEFT JOIN public.listing_google_merchant_publications p
    ON p.listing_id = l.id
  WHERE l.status = 'active'
    AND l.hidden_from_site = false
    AND l.archived_at IS NULL
    AND l.section = ANY (p_sections)
    AND COALESCE(l.price, 0) > 0
    AND btrim(COALESCE(l.title, '')) <> ''
    AND btrim(l.title) !~* '^admin seed'
    AND (
      btrim(COALESCE(l.primary_image_url, '')) <> ''
      OR btrim(COALESCE(l.primary_thumbnail_url, '')) <> ''
    )
    AND (
      p.listing_id IS NULL
      OR p.published_at IS NULL
      OR p.published_at <= p_published_before
    )
    AND (
      p.last_attempt_at IS NULL
      OR p.last_attempt_at <= p_attempt_before
    )
  ORDER BY p.published_at ASC NULLS LAST, l.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.list_due_google_merchant_listing_ids(timestamptz, timestamptz, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_due_google_merchant_listing_ids(timestamptz, timestamptz, text[], integer) TO service_role;
