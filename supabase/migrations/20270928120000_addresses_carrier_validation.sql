-- Persist carrier-standardized checkout addresses (ShipEngine / UPS / FedEx / USPS).
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS residential text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS address_validated_at timestamptz;

ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_residential_check;

ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_residential_check
  CHECK (residential IN ('yes', 'no', 'unknown'));

COMMENT ON COLUMN public.addresses.residential IS
  'Carrier residential indicator from ShipEngine address validation (yes/no/unknown).';

COMMENT ON COLUMN public.addresses.address_validated_at IS
  'When ShipEngine last verified and cleaned this address against UPS/FedEx/USPS.';
