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

export const shopifyChannelSettingsSchema = z.object({
  sync_mode: z.enum(["manual", "all", "collections", "tags"]).optional(),
  sync_tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  sync_collection_ids: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  auto_sync_enabled: z.boolean().optional(),
  pricing_mode: z.enum(["mirror", "markup", "compare_at"]).optional(),
  markup_percent: z.number().min(0).max(500).optional(),
  default_condition: z.string().trim().max(40).optional(),
})

export type ShopifyImportBody = z.infer<typeof shopifyImportBodySchema>
export type ShopifyBulkImportBody = z.infer<typeof shopifyBulkImportBodySchema>
export type ShopifyChannelSettings = z.infer<typeof shopifyChannelSettingsSchema>
