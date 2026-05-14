-- Admin curation: sellers in this table are sorted to the bottom of the public `/sellers` directory.

CREATE TABLE IF NOT EXISTS public.sellers_directory_demotions (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sellers_directory_demotions_created_at_idx
  ON public.sellers_directory_demotions (created_at);

ALTER TABLE public.sellers_directory_demotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sellers_directory_demotions_select_public" ON public.sellers_directory_demotions;
CREATE POLICY "sellers_directory_demotions_select_public" ON public.sellers_directory_demotions FOR SELECT USING (true);

DROP POLICY IF EXISTS "sellers_directory_demotions_insert_admin" ON public.sellers_directory_demotions;
CREATE POLICY "sellers_directory_demotions_insert_admin" ON public.sellers_directory_demotions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "sellers_directory_demotions_update_admin" ON public.sellers_directory_demotions;
CREATE POLICY "sellers_directory_demotions_update_admin" ON public.sellers_directory_demotions FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

DROP POLICY IF EXISTS "sellers_directory_demotions_delete_admin" ON public.sellers_directory_demotions;
CREATE POLICY "sellers_directory_demotions_delete_admin" ON public.sellers_directory_demotions FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
);

COMMENT ON TABLE public.sellers_directory_demotions IS
  'Profiles demoted to the end of the `/sellers` directory listing. Order among demoted rows follows created_at (oldest demotion first within the demoted block).';
