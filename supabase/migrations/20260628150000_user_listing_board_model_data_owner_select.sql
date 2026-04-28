-- Let sellers read their own listing snapshot row (e.g. /sell edit prefill for model name).
-- Admins retain access via the existing `user_listing_board_model_data_select_admin` policy.

DROP POLICY IF EXISTS "user_listing_board_model_data_select_own_listing"
  ON public.user_listing_board_model_data;

CREATE POLICY "user_listing_board_model_data_select_own_listing"
  ON public.user_listing_board_model_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id AND l.user_id = auth.uid()
    )
  );
