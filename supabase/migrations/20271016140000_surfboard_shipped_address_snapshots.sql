-- Immutable, access-controlled addresses for a Surfboard Shipped order.
-- Buyers can read their order, but not this table; sellers, admins, and the assigned shipper can.

BEGIN;

CREATE TABLE IF NOT EXISTS public.surfboard_shipped_fulfillments (
  order_id uuid PRIMARY KEY REFERENCES public.orders (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  shipper_id uuid NOT NULL REFERENCES public.coastal_shippers (id) ON DELETE RESTRICT,
  run_id uuid NOT NULL REFERENCES public.coastal_shipper_runs (id) ON DELETE RESTRICT,
  pickup_address jsonb NOT NULL,
  dropoff_address jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.surfboard_shipped_fulfillments IS
  'Private immutable pickup and drop-off snapshots captured atomically when a Surfboard Shipped order is created.';
COMMENT ON COLUMN public.surfboard_shipped_fulfillments.pickup_address IS
  'Seller pickup snapshot. Not exposed through the buyer-readable orders table.';
COMMENT ON COLUMN public.surfboard_shipped_fulfillments.dropoff_address IS
  'Buyer delivery snapshot copied from orders.shipping_address.';

CREATE INDEX IF NOT EXISTS surfboard_shipped_fulfillments_shipper_idx
  ON public.surfboard_shipped_fulfillments (shipper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS surfboard_shipped_fulfillments_run_idx
  ON public.surfboard_shipped_fulfillments (run_id, created_at DESC);

ALTER TABLE public.surfboard_shipped_fulfillments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.surfboard_shipped_fulfillments FROM PUBLIC;
REVOKE ALL ON TABLE public.surfboard_shipped_fulfillments FROM anon;
GRANT SELECT ON TABLE public.surfboard_shipped_fulfillments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.surfboard_shipped_fulfillments TO service_role;

DROP POLICY IF EXISTS surfboard_shipped_fulfillments_seller_select
  ON public.surfboard_shipped_fulfillments;
CREATE POLICY surfboard_shipped_fulfillments_seller_select
  ON public.surfboard_shipped_fulfillments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS surfboard_shipped_fulfillments_shipper_select
  ON public.surfboard_shipped_fulfillments;
CREATE POLICY surfboard_shipped_fulfillments_shipper_select
  ON public.surfboard_shipped_fulfillments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coastal_shippers s
      WHERE s.id = shipper_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS surfboard_shipped_fulfillments_admin_select
  ON public.surfboard_shipped_fulfillments;
CREATE POLICY surfboard_shipped_fulfillments_admin_select
  ON public.surfboard_shipped_fulfillments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.snapshot_surfboard_shipped_addresses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pickup jsonb;
BEGIN
  IF NEW.surfboard_shipped IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_address IS NULL
     OR NEW.surfboard_shipped_shipper_id IS NULL
     OR NEW.surfboard_shipped_run_id IS NULL
  THEN
    RAISE EXCEPTION 'Surfboard Shipped order is missing fulfillment details';
  END IF;

  SELECT jsonb_build_object(
    'name', a.full_name,
    'phone', a.phone,
    'address', jsonb_strip_nulls(jsonb_build_object(
      'line1', a.line1,
      'line2', a.line2,
      'city', a.city,
      'state', a.state,
      'postal_code', a.postal_code,
      'country', a.country,
      'residential', a.residential,
      'google_place_id', a.google_place_id,
      'latitude', a.latitude,
      'longitude', a.longitude,
      'formatted_address', a.formatted_address,
      'google_geocoded_at', a.google_geocoded_at
    ))
  )
  INTO pickup
  FROM public.listings l
  JOIN public.addresses a
    ON a.id = l.surfboard_shipped_pickup_address_id
   AND a.profile_id = l.user_id
  WHERE l.id = NEW.listing_id
    AND l.surfboard_shipped = true;

  IF pickup IS NULL THEN
    RAISE EXCEPTION 'Surfboard Shipped pickup address is missing';
  END IF;

  INSERT INTO public.surfboard_shipped_fulfillments (
    order_id,
    listing_id,
    shipper_id,
    run_id,
    pickup_address,
    dropoff_address
  )
  VALUES (
    NEW.id,
    NEW.listing_id,
    NEW.surfboard_shipped_shipper_id,
    NEW.surfboard_shipped_run_id,
    pickup,
    NEW.shipping_address
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_surfboard_shipped_addresses() FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_snapshot_surfboard_shipped_addresses ON public.orders;
CREATE TRIGGER orders_snapshot_surfboard_shipped_addresses
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.surfboard_shipped = true)
  EXECUTE FUNCTION public.snapshot_surfboard_shipped_addresses();

COMMIT;
