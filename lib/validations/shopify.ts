import { z } from "zod"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

export const shopifyConnectQuerySchema = z.object({
  shop: z.string().trim().min(3),
})

export const shopifyImportBodySchema = z.object({
  productId: z.string().trim().min(1),
  variantIds: z.array(z.string().trim().min(1)).optional(),
  section: z.enum(PEER_LISTING_SECTIONS).optional(),
})

export const shopifyBulkImportBodySchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1).max(50),
  section: z.enum(PEER_LISTING_SECTIONS).optional(),
})

export const shopifySectionMappingSchema = z.object({
  signal_type: z.enum(["collection", "product_type", "tag"]),
  signal_value: z.string().trim().min(1).max(200),
  reswell_section: z.enum(PEER_LISTING_SECTIONS),
  priority: z.number().int().min(0).max(10000).optional(),
})

export const shopifyMappingsBodySchema = z.object({
  mappings: z.array(shopifySectionMappingSchema).max(100),
})

export type ShopifyImportBody = z.infer<typeof shopifyImportBodySchema>
export type ShopifyBulkImportBody = z.infer<typeof shopifyBulkImportBodySchema>
