import type { SupabaseClient } from "@supabase/supabase-js"

export interface PnlLoanRow {
  id: string
  name: string
  principal: number
  interest_rate: number | null
  lender: string | null
  started_on: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PnlLoanRepaymentRow {
  id: string
  loan_id: string
  amount: number
  paid_on: string
  notes: string | null
  created_at: string
}

export interface PnlLoanWithRepayments extends PnlLoanRow {
  repayments: PnlLoanRepaymentRow[]
}

export interface PnlLoanInsert {
  name: string
  principal: number
  interest_rate: number | null
  lender: string | null
  started_on: string | null
  notes: string | null
  created_by: string
}

export type PnlLoanUpdate = Partial<Omit<PnlLoanInsert, "created_by">>

export interface PnlLoanRepaymentInsert {
  loan_id: string
  amount: number
  paid_on: string | null
  notes: string | null
  created_by: string
}

const LOAN_COLUMNS =
  "id, name, principal, interest_rate, lender, started_on, notes, created_by, created_at, updated_at"
const REPAYMENT_COLUMNS = "id, loan_id, amount, paid_on, notes, created_at"

export async function listLoansWithRepayments(
  supabase: SupabaseClient,
): Promise<PnlLoanWithRepayments[]> {
  const { data, error } = await supabase
    .from("pnl_loans")
    .select(`${LOAN_COLUMNS}, repayments:pnl_loan_repayments (${REPAYMENT_COLUMNS})`)
    .order("created_at", { ascending: true })

  if (error) throw error

  return ((data ?? []) as (PnlLoanRow & { repayments: PnlLoanRepaymentRow[] | null })[]).map(
    (loan) => ({
      ...loan,
      repayments: (loan.repayments ?? []).sort((a, b) => b.paid_on.localeCompare(a.paid_on)),
    }),
  )
}

export async function insertLoan(
  supabase: SupabaseClient,
  values: PnlLoanInsert,
): Promise<PnlLoanRow> {
  const { data, error } = await supabase
    .from("pnl_loans")
    .insert(values)
    .select(LOAN_COLUMNS)
    .single()

  if (error) throw error
  return data as PnlLoanRow
}

export async function updateLoanRow(
  supabase: SupabaseClient,
  id: string,
  values: PnlLoanUpdate,
): Promise<PnlLoanRow> {
  const { data, error } = await supabase
    .from("pnl_loans")
    .update(values)
    .eq("id", id)
    .select(LOAN_COLUMNS)
    .single()

  if (error) throw error
  return data as PnlLoanRow
}

export async function deleteLoanRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("pnl_loans").delete().eq("id", id)
  if (error) throw error
}

export async function insertLoanRepayment(
  supabase: SupabaseClient,
  values: PnlLoanRepaymentInsert,
): Promise<PnlLoanRepaymentRow> {
  const { data, error } = await supabase
    .from("pnl_loan_repayments")
    .insert(values)
    .select(REPAYMENT_COLUMNS)
    .single()

  if (error) throw error
  return data as PnlLoanRepaymentRow
}

export async function deleteLoanRepaymentRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("pnl_loan_repayments").delete().eq("id", id)
  if (error) throw error
}
