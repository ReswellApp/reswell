import { z } from "zod"
import { FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX } from "@/lib/facebook-marketplace/categories"

export const facebookMarketplaceBulkSellerSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 30
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 30
      return Math.min(Math.max(Math.trunc(n), 1), 100)
    }),
})

export const facebookMarketplaceBulkSellerIdSchema = z.string().trim().uuid("seller_id must be a UUID")

export const facebookMarketplaceBulkExportBodySchema = z.object({
  seller_id: facebookMarketplaceBulkSellerIdSchema,
  listing_ids: z
    .array(z.string().trim().uuid())
    .min(1, "Select at least one listing")
    .max(
      FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX,
      `Facebook Marketplace allows up to ${FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX} listings per file`,
    ),
})

export type FacebookMarketplaceBulkExportBody = z.infer<typeof facebookMarketplaceBulkExportBodySchema>

export const facebookMarketplaceBulkPhotosQuerySchema = z.object({
  seller_id: facebookMarketplaceBulkSellerIdSchema,
})

export type FacebookMarketplaceBulkPhotosQuery = z.infer<
  typeof facebookMarketplaceBulkPhotosQuerySchema
>
