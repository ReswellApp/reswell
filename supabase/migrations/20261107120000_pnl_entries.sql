-- Surfboard buy/sell profit-and-loss ledger for the admin P&L tracker.
-- One row per board: acquisition cost, sale proceeds, fees, and status.
-- Staff-only via RLS. Profit is derived in the app layer, not stored.

CREATE TABLE IF NOT EXISTS public.pnl_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'inventory'
    CHECK (status IN ('inventory', 'listed', 'sold')),
  purchase_price numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (purchase_price >= 0),
  purchase_date date,
  sale_price numeric(12, 2)
    CHECK (sale_price IS NULL OR sale_price >= 0),
  sale_date date,
  shipping_cost numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (shipping_cost >= 0),
  platform_fee numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (platform_fee >= 0),
  other_costs numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (other_costs >= 0),
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pnl_entries_status_idx ON public.pnl_entries (status);
CREATE INDEX IF NOT EXISTS pnl_entries_sale_date_idx ON public.pnl_entries (sale_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS pnl_entries_purchase_date_idx ON public.pnl_entries (purchase_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS pnl_entries_created_by_idx ON public.pnl_entries (created_by);

COMMENT ON TABLE public.pnl_entries IS
  'Admin surfboard buy/sell P&L ledger. Staff-only via RLS; profit derived in app.';

-- Keep updated_at fresh on every mutation.
CREATE OR REPLACE FUNCTION public.pnl_entries_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pnl_entries_updated_at ON public.pnl_entries;
CREATE TRIGGER pnl_entries_updated_at
  BEFORE UPDATE ON public.pnl_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.pnl_entries_set_updated_at();

-- RLS: admin + employee staff only.
ALTER TABLE public.pnl_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pnl_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin IS TRUE OR p.is_employee IS TRUE)
  );
$$;

DROP POLICY IF EXISTS "pnl_entries_staff_all" ON public.pnl_entries;
CREATE POLICY "pnl_entries_staff_all" ON public.pnl_entries
  FOR ALL
  TO authenticated
  USING (public.pnl_is_staff())
  WITH CHECK (public.pnl_is_staff());
