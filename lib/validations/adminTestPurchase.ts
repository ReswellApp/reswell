import { z } from "zod"

export const adminTestPurchaseBodySchema = z.object({
  listing_ref: z.string().trim().min(1),
  fulfillment: z.enum(["pickup", "shipping"]).optional(),
})

export type AdminTestPurchaseBody = z.infer<typeof adminTestPurchaseBodySchema>

export const adminTestPurchaseListingPreviewSchema = z.object({
  listing_ref: z.string().trim().min(1),
})
