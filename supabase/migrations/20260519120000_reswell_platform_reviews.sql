-- User-submitted ratings for the Reswell marketplace platform itself.

CREATE TABLE IF NOT EXISTS public.reswell_platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  description text NOT NULL,
  rating smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reswell_platform_reviews_full_name_nonempty CHECK (length(trim(full_name)) > 0),
  CONSTRAINT reswell_platform_reviews_description_nonempty CHECK (length(trim(description)) > 0),
  CONSTRAINT reswell_platform_reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reswell_platform_reviews_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS reswell_platform_reviews_created_at_idx
  ON public.reswell_platform_reviews (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_reswell_platform_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reswell_platform_reviews_updated_at ON public.reswell_platform_reviews;
CREATE TRIGGER reswell_platform_reviews_updated_at
  BEFORE UPDATE ON public.reswell_platform_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reswell_platform_reviews_updated_at();

ALTER TABLE public.reswell_platform_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reswell_platform_reviews_select_public" ON public.reswell_platform_reviews;
CREATE POLICY "reswell_platform_reviews_select_public" ON public.reswell_platform_reviews
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "reswell_platform_reviews_insert_own" ON public.reswell_platform_reviews;
CREATE POLICY "reswell_platform_reviews_insert_own" ON public.reswell_platform_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reswell_platform_reviews_update_own" ON public.reswell_platform_reviews;
CREATE POLICY "reswell_platform_reviews_update_own" ON public.reswell_platform_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reswell_platform_reviews_select_staff" ON public.reswell_platform_reviews;
CREATE POLICY "reswell_platform_reviews_select_staff" ON public.reswell_platform_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_employee = true)
    )
  );

COMMENT ON TABLE public.reswell_platform_reviews IS 'Logged-in user ratings of the Reswell platform (one review per user).';
