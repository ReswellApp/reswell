-- Nav search personalization: recently opened brand profiles from dropdown picks.

CREATE TABLE IF NOT EXISTS public.user_recently_viewed_brands (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id   UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS user_recently_viewed_brands_user_viewed_idx
  ON public.user_recently_viewed_brands (user_id, viewed_at DESC);

ALTER TABLE public.user_recently_viewed_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_recently_viewed_brands_own" ON public.user_recently_viewed_brands;
CREATE POLICY "user_recently_viewed_brands_own" ON public.user_recently_viewed_brands
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_recently_viewed_brands IS
  'Brand profile picks from nav search dropdowns for logged-in personalization.';
