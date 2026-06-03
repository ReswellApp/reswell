import { z } from "zod"

export const pnlStatusSchema = z.enum(["inventory", "listed", "sold"])

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v))
  .optional()

const money = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (v === "" || v == null) return undefined
    const num = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))
    return Number.isFinite(num) ? num : undefined
  })
  .refine((v) => v === undefined || v >= 0, "Must be zero or more")

const requiredMoney = money.transform((v) => v ?? 0)

export const createPnlEntrySchema = z.object({
  boardName: z.string().trim().min(1, "Board name is required").max(160),
  category: optionalText,
  status: pnlStatusSchema.optional().default("inventory"),
  purchasePrice: requiredMoney,
  purchaseDate: optionalDate,
  salePrice: z.union([money, z.null()]).optional(),
  saleDate: optionalDate,
  shippingCost: requiredMoney,
  platformFee: requiredMoney,
  otherCosts: requiredMoney,
  notes: optionalText,
})

export const updatePnlEntrySchema = z.object({
  id: z.string().uuid(),
  boardName: z.string().trim().min(1, "Board name is required").max(160).optional(),
  category: z.union([z.string().trim().max(80), z.literal(""), z.null()]).optional(),
  status: pnlStatusSchema.optional(),
  purchasePrice: money.optional(),
  purchaseDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  salePrice: z.union([money, z.null()]).optional(),
  saleDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  shippingCost: money.optional(),
  platformFee: money.optional(),
  otherCosts: money.optional(),
  notes: z.union([z.string().trim().max(5000), z.literal(""), z.null()]).optional(),
})

export const deletePnlEntrySchema = z.object({
  id: z.string().uuid(),
})

export const attachReswellOrderSchema = z.object({
  orderId: z.string().uuid(),
})

export const attachReswellListingSchema = z.object({
  listingId: z.string().uuid(),
})

const optionalRate = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (v === "" || v == null) return undefined
    const num = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""))
    return Number.isFinite(num) ? num : undefined
  })
  .refine((v) => v === undefined || v >= 0, "Must be zero or more")

export const createLoanSchema = z.object({
  name: z.string().trim().min(1, "Loan name is required").max(120),
  principal: requiredMoney,
  interestRate: optionalRate.optional(),
  lender: optionalText,
  startedOn: optionalDate,
  notes: optionalText,
})

export const updateLoanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  principal: money.optional(),
  interestRate: z.union([optionalRate, z.null()]).optional(),
  lender: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  startedOn: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  notes: z.union([z.string().trim().max(5000), z.literal(""), z.null()]).optional(),
})

export const deleteLoanSchema = z.object({
  id: z.string().uuid(),
})

export const createLoanRepaymentSchema = z.object({
  loanId: z.string().uuid(),
  amount: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const num = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))
      return Number.isFinite(num) ? num : NaN
    })
    .refine((v) => Number.isFinite(v) && v > 0, "Enter a repayment amount"),
  paidOn: optionalDate,
  notes: optionalText,
})

export const deleteLoanRepaymentSchema = z.object({
  id: z.string().uuid(),
})

export type CreatePnlEntryInput = z.infer<typeof createPnlEntrySchema>
export type UpdatePnlEntryInput = z.infer<typeof updatePnlEntrySchema>
