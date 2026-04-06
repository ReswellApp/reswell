-- Saved postal addresses for any profile (buyer shipping, seller locations, account settings).
-- One profile : many addresses. Application enforces a single "default" per profile when is_default = true.

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS addresses_profile_id_idx
  ON public.addresses (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_profile
  ON public.addresses (profile_id)
  WHERE is_default = true;

COMMENT ON TABLE public.addresses IS
  'Physical mailing/shipping addresses for a member profile (buyer checkout, seller, profile UI).';

COMMENT ON COLUMN public.addresses.label IS
  'Optional nickname, e.g. Home, Shop, Warehouse.';

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses_select_own" ON public.addresses;
CREATE POLICY "addresses_select_own" ON public.addresses
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "addresses_insert_own" ON public.addresses;
CREATE POLICY "addresses_insert_own" ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "addresses_update_own" ON public.addresses;
CREATE POLICY "addresses_update_own" ON public.addresses
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "addresses_delete_own" ON public.addresses;
CREATE POLICY "addresses_delete_own" ON public.addresses
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_addresses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_set_updated_at ON public.addresses;
CREATE TRIGGER addresses_set_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_addresses_updated_at();
