-- Apparel category (kind) for peer used apparel listings.
-- Sellers must pick a kind when listing; /apparel browse filters by it.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS apparel_kind text;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_apparel_kind_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_apparel_kind_check CHECK (
    apparel_kind IS NULL
    OR apparel_kind IN ('boardshorts', 'hat', 't_shirt', 'other')
  );

COMMENT ON COLUMN public.listings.apparel_kind IS
  'Apparel category slug for section=apparel listings (boardshorts | hat | t_shirt | other). Null for other sections or legacy rows.';

CREATE INDEX IF NOT EXISTS listings_apparel_kind_idx
  ON public.listings (apparel_kind)
  WHERE section = 'apparel' AND apparel_kind IS NOT NULL;

COMMIT;
