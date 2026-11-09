-- Pickup and delivery windows on a shipper trip.
-- day_of_week stays the pickup start so existing weekly and one-week rows still match.
-- Hayden pastes this in the Supabase SQL editor. Safe to run once.

BEGIN;

ALTER TABLE public.coastal_shipper_runs
  ADD COLUMN IF NOT EXISTS pickup_start_dow smallint,
  ADD COLUMN IF NOT EXISTS pickup_end_dow smallint,
  ADD COLUMN IF NOT EXISTS delivery_start_dow smallint,
  ADD COLUMN IF NOT EXISTS delivery_end_dow smallint,
  ADD COLUMN IF NOT EXISTS pickup_description text,
  ADD COLUMN IF NOT EXISTS delivery_description text;

UPDATE public.coastal_shipper_runs
SET
  pickup_start_dow = COALESCE(pickup_start_dow, day_of_week),
  pickup_end_dow = COALESCE(pickup_end_dow, day_of_week),
  delivery_start_dow = COALESCE(delivery_start_dow, day_of_week),
  delivery_end_dow = COALESCE(delivery_end_dow, day_of_week)
WHERE pickup_start_dow IS NULL
   OR pickup_end_dow IS NULL
   OR delivery_start_dow IS NULL
   OR delivery_end_dow IS NULL;

ALTER TABLE public.coastal_shipper_runs
  DROP CONSTRAINT IF EXISTS coastal_shipper_runs_windows_check;

ALTER TABLE public.coastal_shipper_runs
  ADD CONSTRAINT coastal_shipper_runs_windows_check
  CHECK (
    pickup_start_dow IS NULL
    OR (
      pickup_start_dow BETWEEN 0 AND 6
      AND pickup_end_dow BETWEEN pickup_start_dow AND 6
      AND delivery_start_dow BETWEEN pickup_start_dow AND 6
      AND delivery_end_dow BETWEEN delivery_start_dow AND 6
    )
  );

ALTER TABLE public.coastal_shipper_runs
  DROP CONSTRAINT IF EXISTS coastal_shipper_runs_descriptions_check;

ALTER TABLE public.coastal_shipper_runs
  ADD CONSTRAINT coastal_shipper_runs_descriptions_check
  CHECK (
    (pickup_description IS NULL OR char_length(btrim(pickup_description)) BETWEEN 2 AND 160)
    AND (delivery_description IS NULL OR char_length(btrim(delivery_description)) BETWEEN 2 AND 160)
  );

COMMENT ON COLUMN public.coastal_shipper_runs.pickup_start_dow IS
  'Pickup window start. 0 = Sunday through 6 = Saturday, America/Los_Angeles. Matches day_of_week.';
COMMENT ON COLUMN public.coastal_shipper_runs.pickup_end_dow IS
  'Pickup window end, on or after pickup_start_dow. Same day is one day.';
COMMENT ON COLUMN public.coastal_shipper_runs.delivery_start_dow IS
  'Delivery window start, on or after the pickup start.';
COMMENT ON COLUMN public.coastal_shipper_runs.delivery_end_dow IS
  'Delivery window end, on or after delivery_start_dow.';
COMMENT ON COLUMN public.coastal_shipper_runs.pickup_description IS
  'Short text the seller sees on /sell/boards while this shipper is live.';
COMMENT ON COLUMN public.coastal_shipper_runs.delivery_description IS
  'Short text checkout shows with the delivery window.';

COMMIT;
