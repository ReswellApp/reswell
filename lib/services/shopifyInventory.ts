import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbGetShopifyMappingById,
  dbListShopifyMappingsByInventoryItem,
  dbUpdateShopifyInventoryListings,
} from "@/lib/db/shopifyCatalog"
import {
  decrementShopifyInventory,
  fetchShopifyInventoryLevels,
  shopifyAvailableInventory,
} from "@/lib/shopify/catalog"
import { areShopifyInventoryWritesEnabled } from "@/lib/shopify/config"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

export class ShopifyInventoryWritesDisabledError extends Error {
  constructor() {
    super("Shopify inventory writes are disabled by the kill switch")
    this.name = "ShopifyInventoryWritesDisabledError"
  }
}

export async function decrementShopifyInventoryForReswellSale(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  jobId: string
  mappingId: string
  orderId: string
  quantity: number
}): Promise<void> {
  if (!areShopifyInventoryWritesEnabled()) {
    throw new ShopifyInventoryWritesDisabledError()
  }
  const mapping = await dbGetShopifyMappingById(
    input.serviceSupabase,
    input.mappingId,
  )
  if (!mapping || mapping.connection_id !== input.connection.id) {
    throw new Error("Shopify product mapping no longer exists")
  }

  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  const levels = await fetchShopifyInventoryLevels({
    shopDomain: input.connection.shop_domain,
    accessToken,
    inventoryItemId: mapping.shopify_inventory_item_gid,
  })
  const source = [...levels]
    .filter((level) => level.available > 0)
    .sort((left, right) => right.available - left.available)[0]
  const totalBefore = shopifyAvailableInventory(levels)

  if (source) {
    await decrementShopifyInventory({
      shopDomain: input.connection.shop_domain,
      accessToken,
      inventoryItemId: mapping.shopify_inventory_item_gid,
      locationId: source.locationId,
      currentAvailable: source.available,
      quantity: Math.min(
        source.available,
        Math.max(1, Math.floor(input.quantity)),
      ),
      idempotencyKey: input.jobId,
      orderId: input.orderId,
    })
  }

  const mappings = await dbListShopifyMappingsByInventoryItem(
    input.serviceSupabase,
    input.connection.id,
    mapping.shopify_inventory_item_gid,
  )
  await dbUpdateShopifyInventoryListings(
    input.serviceSupabase,
    mappings,
    Math.max(0, totalBefore - Math.max(1, Math.floor(input.quantity))),
  )
}
