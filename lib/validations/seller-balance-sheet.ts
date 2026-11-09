import { z } from "zod"

export const BALANCE_SHEET_SORTS = ["recent", "missing-paid"] as const

export const balanceSheetSortSchema = z.enum(BALANCE_SHEET_SORTS).catch("recent")

export type BalanceSheetSort = (typeof BALANCE_SHEET_SORTS)[number]

export const BALANCE_SHEET_VIEWS = ["all", "active", "sold"] as const

export const balanceSheetViewSchema = z.enum(BALANCE_SHEET_VIEWS).catch("all")

export type BalanceSheetView = (typeof BALANCE_SHEET_VIEWS)[number]

export const BALANCE_SHEET_PERIODS = ["month", "3m", "all"] as const

export const balanceSheetPeriodSchema = z.enum(BALANCE_SHEET_PERIODS).catch("all")

export type BalanceSheetPeriod = (typeof BALANCE_SHEET_PERIODS)[number]

export const removeBalanceSheetItemSchema = z.object({
  listingId: z.string().uuid(),
})

export type RemoveBalanceSheetItemInput = z.infer<
  typeof removeBalanceSheetItemSchema
>
