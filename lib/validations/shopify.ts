import { z } from "zod"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

const shopifyProductGid = z
  .string()
  .regex(/^gid:\/\/shopify\/Product\/\d+$/, "Invalid Shopify product")

export const shopifyConnectQuerySchema = z.object({
  shop: z.string().trim().min(3).max(255),
})

export const shopifyProductsQuerySchema = z.object({
  query: z.string().trim().max(200).optional().default(""),
  after: z.string().trim().max(500).optional(),
})

export const shopifyProductSelectionSchema = z.object({
  productId: shopifyProductGid,
  section: z.enum(PEER_LISTING_SECTIONS),
})

export const shopifyProductUnpublishSchema = z.object({
  productId: shopifyProductGid,
})

export const shopifyWebhookHeadersSchema = z.object({
  shopDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/),
  topic: z.string().trim().min(1).max(100),
  webhookId: z.string().trim().min(1).max(200),
})

export const shopifyInventoryDecrementPayloadSchema = z.object({
  mappingId: z.string().uuid(),
  listingId: z.string().uuid(),
  orderId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
})

export const shopifyProductJobPayloadSchema = z.object({
  productId: shopifyProductGid,
})

export const shopifyInventoryJobPayloadSchema = z.object({
  inventoryItemId: z
    .string()
    .regex(/^gid:\/\/shopify\/InventoryItem\/\d+$/),
})

export const shopifyReconcileJobPayloadSchema = z.object({
  connectionId: z.string().uuid(),
})
