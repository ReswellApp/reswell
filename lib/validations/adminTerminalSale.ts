import { z } from "zod"

export const adminTerminalListingSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 20
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 20
      return Math.min(Math.max(Math.trunc(n), 1), 50)
    }),
})

export const adminTerminalListingPreviewSchema = z
  .object({
    listing_ref: z.string().trim().optional(),
    listing_id: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.listing_ref?.trim() || v.listing_id), {
    message: "listing_ref or listing_id is required",
  })

export const adminTerminalCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email("Customer email is required"),
  phone: z.string().trim().optional(),
})

export const adminTerminalSaleStartSchema = z
  .object({
    listingId: z.string().uuid(),
    readerId: z.string().trim().min(1),
    buyerId: z.string().uuid().optional(),
    customer: adminTerminalCustomerSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.buyerId) return
    if (!data.customer?.firstName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "First name is required",
        path: ["customer", "firstName"],
      })
    }
    if (!data.customer?.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer email is required",
        path: ["customer", "email"],
      })
    }
  })

export type AdminTerminalSaleStartInput = z.infer<typeof adminTerminalSaleStartSchema>

export const adminTerminalSaleFinalizeSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
})

export const adminTerminalSaleCancelSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
  readerId: z.string().trim().optional(),
})
