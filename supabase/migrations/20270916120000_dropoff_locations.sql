-- Reswell pack-and-ship dropoff locations (Santa Barbara first).
-- Sellers can choose a location on /sell/boards instead of entering a box size.
-- Admin sets per-location box rules and reviews listings that opted in.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dropoff_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  latitude double precision,
  longitude double precision,
  phone text,
  hours_note text,
  box_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dropoff_locations_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT dropoff_locations_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT dropoff_locations_city_nonempty CHECK (char_length(trim(city)) > 0),
  CONSTRAINT dropoff_locations_state_nonempty CHECK (char_length(trim(state)) > 0),
  CONSTRAINT dropoff_locations_postal_nonempty CHECK (char_length(trim(postal_code)) > 0)
);

COMMENT ON TABLE public.dropoff_locations IS
  'Physical Reswell dropoff sites where sellers leave a sold board to be packed and shipped.';
COMMENT ON COLUMN public.dropoff_locations.box_rules IS
  'JSON array of {id,label,minLengthIn,maxLengthIn,maxWidthIn,boxLengthIn,boxWidthIn,boxHeightIn,weightLb}. First matching rule wins.';

CREATE INDEX IF NOT EXISTS dropoff_locations_active_sort_idx
  ON public.dropoff_locations (active, sort_order, name);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS dropoff_location_id uuid REFERENCES public.dropoff_locations (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.listings.dropoff_location_id IS
  'When set, the seller will drop this listing at that location after a shipping sale. Packed carton comes from the location box rules (admin can override shipping_packed_*).';

CREATE INDEX IF NOT EXISTS listings_dropoff_location_id_idx
  ON public.listings (dropoff_location_id)
  WHERE dropoff_location_id IS NOT NULL;

DROP TRIGGER IF EXISTS dropoff_locations_set_updated_at ON public.dropoff_locations;
CREATE TRIGGER dropoff_locations_set_updated_at
  BEFORE UPDATE ON public.dropoff_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dropoff_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dropoff_locations_select_all ON public.dropoff_locations;
CREATE POLICY dropoff_locations_select_all
  ON public.dropoff_locations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS dropoff_locations_admin_insert ON public.dropoff_locations;
CREATE POLICY dropoff_locations_admin_insert
  ON public.dropoff_locations
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS dropoff_locations_admin_update ON public.dropoff_locations;
CREATE POLICY dropoff_locations_admin_update
  ON public.dropoff_locations
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS dropoff_locations_admin_delete ON public.dropoff_locations;
CREATE POLICY dropoff_locations_admin_delete
  ON public.dropoff_locations
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

INSERT INTO public.dropoff_locations (
  id,
  slug,
  name,
  address_line1,
  city,
  state,
  postal_code,
  country,
  latitude,
  longitude,
  hours_note,
  box_rules,
  active,
  sort_order
)
VALUES (
  '7f3c1a90-4e2b-4d8a-9f11-2c6e8b4a1d05',
  'santa-barbara',
  'Santa Barbara',
  '915 De La Vina',
  'Santa Barbara',
  'CA',
  '93101',
  'US',
  34.4194,
  -119.7058,
  'After your board sells, drop it here and Reswell will pack and ship it.',
  '[
    {
      "id": "under-6-0",
      "label": "6''0 and under, 22\" wide or less",
      "minLengthIn": null,
      "maxLengthIn": 72,
      "maxWidthIn": 22,
      "boxLengthIn": 76,
      "boxWidthIn": 22,
      "boxHeightIn": 5,
      "weightLb": 14
    },
    {
      "id": "6-1-to-6-6",
      "label": "6''1–6''6",
      "minLengthIn": 72.01,
      "maxLengthIn": 78,
      "maxWidthIn": null,
      "boxLengthIn": 84,
      "boxWidthIn": 22,
      "boxHeightIn": 5,
      "weightLb": 18
    }
  ]'::jsonb,
  true,
  0
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
