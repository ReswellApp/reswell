import { createClient } from "@/lib/supabase/server"
import {
  deleteLoanRepaymentRow,
  deleteLoanRow,
  insertLoan,
  insertLoanRepayment,
  listLoansWithRepayments,
  updateLoanRow,
  type PnlLoanInsert,
  type PnlLoanRepaymentRow,
  type PnlLoanRow,
  type PnlLoanUpdate,
  type PnlLoanWithRepayments,
} from "@/lib/db/pnlLoans"
import {
  createLoanRepaymentSchema,
  createLoanSchema,
  deleteLoanRepaymentSchema,
  deleteLoanSchema,
  updateLoanSchema,
} from "@/lib/validations/pnl"
import { requireStaffUserId, type PnlServiceError } from "@/lib/services/pnlAuth"

type ServiceError = PnlServiceError

function nullable(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value
}

export async function listLoansService(): Promise<
  { data: PnlLoanWithRepayments[] } | ServiceError
> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff
  try {
    const supabase = await createClient()
    const data = await listLoansWithRepayments(supabase)
    return { data }
  } catch {
    return { error: "Could not load loans." }
  }
}

export async function createLoanService(raw: unknown): Promise<{ data: PnlLoanRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = createLoanSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid loan." }
  }
  const input = parsed.data

  const values: PnlLoanInsert = {
    name: input.name,
    principal: input.principal,
    interest_rate: input.interestRate ?? null,
    lender: nullable(input.lender),
    started_on: nullable(input.startedOn),
    notes: nullable(input.notes),
    created_by: staff.userId,
  }

  try {
    const supabase = await createClient()
    const data = await insertLoan(supabase, values)
    return { data }
  } catch {
    return { error: "Could not create loan." }
  }
}

export async function updateLoanService(raw: unknown): Promise<{ data: PnlLoanRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = updateLoanSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid update." }
  }
  const { id, ...input } = parsed.data

  const values: PnlLoanUpdate = {}
  if (input.name !== undefined) values.name = input.name
  if (input.principal !== undefined) values.principal = input.principal
  if (input.interestRate !== undefined) values.interest_rate = input.interestRate ?? null
  if (input.lender !== undefined) values.lender = input.lender || null
  if (input.startedOn !== undefined) values.started_on = input.startedOn || null
  if (input.notes !== undefined) values.notes = input.notes || null

  if (Object.keys(values).length === 0) {
    return { error: "Nothing to update." }
  }

  try {
    const supabase = await createClient()
    const data = await updateLoanRow(supabase, id, values)
    return { data }
  } catch {
    return { error: "Could not update loan." }
  }
}

export async function deleteLoanService(raw: unknown): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = deleteLoanSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid loan id." }

  try {
    const supabase = await createClient()
    await deleteLoanRow(supabase, parsed.data.id)
    return { success: true }
  } catch {
    return { error: "Could not delete loan." }
  }
}

export async function createLoanRepaymentService(
  raw: unknown,
): Promise<{ data: PnlLoanRepaymentRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = createLoanRepaymentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid repayment." }
  }
  const input = parsed.data

  try {
    const supabase = await createClient()
    const data = await insertLoanRepayment(supabase, {
      loan_id: input.loanId,
      amount: input.amount,
      paid_on: nullable(input.paidOn),
      notes: nullable(input.notes),
      created_by: staff.userId,
    })
    return { data }
  } catch {
    return { error: "Could not log repayment." }
  }
}

export async function deleteLoanRepaymentService(
  raw: unknown,
): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = deleteLoanRepaymentSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid repayment id." }

  try {
    const supabase = await createClient()
    await deleteLoanRepaymentRow(supabase, parsed.data.id)
    return { success: true }
  } catch {
    return { error: "Could not delete repayment." }
  }
}
