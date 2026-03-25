-- Community reviews for index directory board models (brand + model slug), not marketplace listings.

CREATE TABLE IF NOT EXISTS public.board_model_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_slug, model_slug, reviewer_id)
);

CREATE INDEX IF NOT EXISTS board_model_reviews_brand_model_idx
  ON public.board_model_reviews (brand_slug, model_slug);

CREATE INDEX IF NOT EXISTS board_model_reviews_created_idx
  ON public.board_model_reviews (brand_slug, model_slug, created_at DESC);

ALTER TABLE public.board_model_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_model_reviews_select_public" ON public.board_model_reviews;
DROP POLICY IF EXISTS "board_model_reviews_insert_own" ON public.board_model_reviews;
DROP POLICY IF EXISTS "board_model_reviews_update_own" ON public.board_model_reviews;

CREATE POLICY "board_model_reviews_select_public"
  ON public.board_model_reviews FOR SELECT USING (true);

CREATE POLICY "board_model_reviews_insert_own"
  ON public.board_model_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "board_model_reviews_update_own"
  ON public.board_model_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);
