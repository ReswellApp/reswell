-- Carrier tracking snapshot (e.g. ShipEngine / ShipStation API track webhooks).
-- Informational only — buyer still confirms delivery in-app to release seller payout.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_detail jsonb;

COMMENT ON COLUMN public.orders.tracking_detail IS
  'Latest carrier tracking snapshot from webhooks (JSON). Not used for marketplace settlement; buyer confirm-delivery remains authoritative.';
