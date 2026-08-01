-- Denormalized why a listing is hidden from the public site (vacation vs inactivity, etc.).
-- Null when the listing is not hidden. Used for seller/admin UX; ES/Merchant use the shared
-- discovery eligibility helpers (status + hidden_from_site + archived_at).

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS site_visibility_reason text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_site_visibility_reason_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_site_visibility_reason_check CHECK (
    site_visibility_reason IS NULL
    OR site_visibility_reason IN (
      'seller_vacation',
      'seller_inactivity',
      'admin_site_visibility',
      'seller_archive',
      'admin_status',
      'system'
    )
  );

COMMENT ON COLUMN public.listings.site_visibility_reason IS
  'Why hidden_from_site is true (seller_vacation | seller_inactivity | admin_site_visibility | seller_archive | admin_status | system). Null when not hidden.';

CREATE INDEX IF NOT EXISTS listings_site_visibility_reason_idx
  ON public.listings (site_visibility_reason)
  WHERE site_visibility_reason IS NOT NULL;

-- Backfill: latest hide event source that maps to an allowed reason; else system.
WITH latest_hide AS (
  SELECT DISTINCT ON (e.listing_id)
    e.listing_id,
    e.source
  FROM public.listing_visibility_events e
  WHERE e.hidden_from_site = true
  ORDER BY e.listing_id, e.created_at DESC
)
UPDATE public.listings l
SET site_visibility_reason = CASE
  WHEN lh.source IN (
    'seller_vacation',
    'seller_inactivity',
    'admin_site_visibility',
    'seller_archive',
    'admin_status',
    'system'
  ) THEN lh.source
  ELSE 'system'
END
FROM latest_hide lh
WHERE l.id = lh.listing_id
  AND l.hidden_from_site = true
  AND l.site_visibility_reason IS NULL;

UPDATE public.listings
SET site_visibility_reason = 'system'
WHERE hidden_from_site = true
  AND site_visibility_reason IS NULL;

-- Visible rows should not carry a reason.
UPDATE public.listings
SET site_visibility_reason = NULL
WHERE hidden_from_site = false
  AND site_visibility_reason IS NOT NULL;

COMMIT;
