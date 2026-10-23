-- Name printed on prepaid carrier labels. Separate from the legal name
-- (profiles.first_name / last_name) and from the public display name.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipping_label_name TEXT;

COMMENT ON COLUMN public.profiles.shipping_label_name IS
  'Optional ship-from name printed on prepaid labels. When empty, shop name (shops) or display name is used. Never the legal name.';
