-- Audit log for the daily backfill cron that attaches a directory brand / catalog
-- model to active listings by matching the listing title against the catalog.
-- Each row records one auto-attach so admins can cross-verify the cron's work.
-- The cron writes via the service role (bypasses RLS); staff may read.

CREATE TABLE IF NOT EXISTS public.listing_brand_model_autofills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  listing_title text,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  brand_name text,
  brand_model_id uuid REFERENCES public.brand_models (id) ON DELETE SET NULL,
  model_name text,
  attached_brand boolean NOT NULL DEFAULT false,
  attached_model boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'title_backfill',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_brand_model_autofills_created_idx
  ON public.listing_brand_model_autofills (created_at DESC);

CREATE INDEX IF NOT EXISTS listing_brand_model_autofills_listing_idx
  ON public.listing_brand_model_autofills (listing_id);

COMMENT ON TABLE public.listing_brand_model_autofills IS
  'Audit log of brand/model links auto-attached to listings by the daily title-backfill cron. One row per attach event for admin verification.';

ALTER TABLE public.listing_brand_model_autofills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_brand_model_autofills_select_staff" ON public.listing_brand_model_autofills;
CREATE POLICY "listing_brand_model_autofills_select_staff" ON public.listing_brand_model_autofills
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_admin = true OR p.is_employee = true)
    )
  );
