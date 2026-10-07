import { z } from "zod"

export const BALANCE_SHEET_SORTS = ["recent", "missing-paid"] as const

export const balanceSheetSortSchema = z.enum(BALANCE_SHEET_SORTS).catch("recent")

export type BalanceSheetSort = (typeof BALANCE_SHEET_SORTS)[number]

export const removeBalanceSheetItemSchema = z.object({
  listingId: z.string().uuid(),
})

export type RemoveBalanceSheetItemInput = z.infer<
  typeof removeBalanceSheetItemSchema
>
