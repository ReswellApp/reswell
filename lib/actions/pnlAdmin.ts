"use server"

import { revalidatePath } from "next/cache"
import {
  attachReswellListingService,
  attachReswellOrderService,
  createPnlEntryService,
  deletePnlEntryService,
  listReswellTransactionsService,
  updatePnlEntryService,
  type ReswellAttachables,
} from "@/lib/services/pnl"
import {
  createLoanRepaymentService,
  createLoanService,
  deleteLoanRepaymentService,
  deleteLoanService,
  updateLoanService,
} from "@/lib/services/pnlLoans"
import type { PnlEntryRow } from "@/lib/db/pnl"
import type { PnlLoanRepaymentRow, PnlLoanRow } from "@/lib/db/pnlLoans"

const PNL_PATH = "/admin/pnl"

export async function createPnlEntryAction(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | { error: string }> {
  const result = await createPnlEntryService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function updatePnlEntryAction(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | { error: string }> {
  const result = await updatePnlEntryService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function deletePnlEntryAction(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const result = await deletePnlEntryService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { success: true }
}

export async function loadReswellTransactionsAction(): Promise<
  { data: ReswellAttachables } | { error: string }
> {
  return listReswellTransactionsService()
}

export async function attachReswellOrderAction(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | { error: string }> {
  const result = await attachReswellOrderService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function attachReswellListingAction(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | { error: string }> {
  const result = await attachReswellListingService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function createLoanAction(
  raw: unknown,
): Promise<{ data: PnlLoanRow } | { error: string }> {
  const result = await createLoanService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function updateLoanAction(
  raw: unknown,
): Promise<{ data: PnlLoanRow } | { error: string }> {
  const result = await updateLoanService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function deleteLoanAction(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const result = await deleteLoanService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { success: true }
}

export async function createLoanRepaymentAction(
  raw: unknown,
): Promise<{ data: PnlLoanRepaymentRow } | { error: string }> {
  const result = await createLoanRepaymentService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { data: result.data }
}

export async function deleteLoanRepaymentAction(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const result = await deleteLoanRepaymentService(raw)
  if ("error" in result) return { error: result.error }
  revalidatePath(PNL_PATH)
  return { success: true }
}
