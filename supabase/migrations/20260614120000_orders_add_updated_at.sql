-- Ensure orders has updated_at (missing when 20260429 archive/rebuild was partially applied).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
