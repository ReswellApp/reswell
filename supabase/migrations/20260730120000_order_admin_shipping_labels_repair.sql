-- Repair order_admin_shipping_labels when the table predates the full definition
-- (CREATE TABLE IF NOT EXISTS does not add new columns). Fixes insert failures after
-- buying a ShipEngine label when columns or CHECK(source) are out of date.
--
-- Safe: this table only uses CHECK constraints on `source` (no other CHECKs in base migration).

DO $$
DECLARE
  con record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'order_admin_shipping_labels'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.order_admin_shipping_labels
    ADD COLUMN IF NOT EXISTS shipengine_rate_id text;
  ALTER TABLE public.order_admin_shipping_labels
    ADD COLUMN IF NOT EXISTS label_pdf_url text;
  ALTER TABLE public.order_admin_shipping_labels
    ADD COLUMN IF NOT EXISTS label_storage_path text;
  ALTER TABLE public.order_admin_shipping_labels
    ADD COLUMN IF NOT EXISTS tracking_number text;
  ALTER TABLE public.order_admin_shipping_labels
    ADD COLUMN IF NOT EXISTS tracking_carrier text;

  FOR con IN
    SELECT c.conname AS name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'order_admin_shipping_labels'
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.order_admin_shipping_labels DROP CONSTRAINT %I', con.name);
  END LOOP;

  ALTER TABLE public.order_admin_shipping_labels
    ADD CONSTRAINT order_admin_shipping_labels_source_check
    CHECK (source IN (
      'shipengine_checkout_lane',
      'manual_label_upload',
      'manual_tracking_buyer'
    ));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
