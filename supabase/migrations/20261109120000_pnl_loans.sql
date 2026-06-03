-- Working-capital loans backing the surfboard buy/sell operation, plus the
-- repayments made against them. Powers the P&L "Financing & capital" view:
-- loan principal, how much capital is left to deploy, and outstanding balance.
-- Staff-only via RLS (reuses public.pnl_is_staff()).

CREATE TABLE IF NOT EXISTS public.pnl_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  principal numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (principal >= 0),
  interest_rate numeric(5, 2)
    CHECK (interest_rate IS NULL OR interest_rate >= 0),
  lender text,
  started_on date,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pnl_loans_created_by_idx ON public.pnl_loans (created_by);

COMMENT ON TABLE public.pnl_loans IS
  'Working-capital loans for the surfboard P&L. Staff-only via RLS.';

CREATE TABLE IF NOT EXISTS public.pnl_loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.pnl_loans (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL
    CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pnl_loan_repayments_loan_id_idx ON public.pnl_loan_repayments (loan_id);
CREATE INDEX IF NOT EXISTS pnl_loan_repayments_paid_on_idx ON public.pnl_loan_repayments (paid_on DESC);

COMMENT ON TABLE public.pnl_loan_repayments IS
  'Repayments made against pnl_loans; outstanding = principal − sum(repayments).';

-- Keep updated_at fresh on loan edits (reuses the entries trigger fn shape).
CREATE OR REPLACE FUNCTION public.pnl_loans_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pnl_loans_updated_at ON public.pnl_loans;
CREATE TRIGGER pnl_loans_updated_at
  BEFORE UPDATE ON public.pnl_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.pnl_loans_set_updated_at();

ALTER TABLE public.pnl_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_loan_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pnl_loans_staff_all" ON public.pnl_loans;
CREATE POLICY "pnl_loans_staff_all" ON public.pnl_loans
  FOR ALL
  TO authenticated
  USING (public.pnl_is_staff())
  WITH CHECK (public.pnl_is_staff());

DROP POLICY IF EXISTS "pnl_loan_repayments_staff_all" ON public.pnl_loan_repayments;
CREATE POLICY "pnl_loan_repayments_staff_all" ON public.pnl_loan_repayments
  FOR ALL
  TO authenticated
  USING (public.pnl_is_staff())
  WITH CHECK (public.pnl_is_staff());
