import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbGetShopifyMappingById,
  dbListShopifyMappingsByInventoryItem,
  dbUpdateShopifyInventoryListings,
} from "@/lib/db/shopifyCatalog"
import { dbPersistShopifyInventoryAttempt } from "@/lib/db/shopifyQueue"
import {
  decrementShopifyInventory,
  fetchShopifyInventoryLevels,
  shopifyAvailableInventory,
} from "@/lib/shopify/catalog"
import { areShopifyInventoryWritesEnabled } from "@/lib/shopify/config"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"
import { compensateShopifyInventoryConflict } from "@/lib/services/shopifyInventoryCompensation"

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
  workerId: string | null
  mappingId: string
  orderId: string
  quantity: number
  locationId?: string
  changeFromQuantity?: number
  remoteTotalBefore?: number
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
  let locationId = input.locationId
  let changeFromQuantity = input.changeFromQuantity
  let totalBefore = input.remoteTotalBefore
  if (
    locationId == null ||
    changeFromQuantity == null ||
    totalBefore == null
  ) {
    const levels = await fetchShopifyInventoryLevels({
      shopDomain: input.connection.shop_domain,
      accessToken,
      inventoryItemId: mapping.shopify_inventory_item_gid,
    })
    const source = [...levels]
      .filter((level) => level.available > 0)
      .sort((left, right) => right.available - left.available)[0]
    totalBefore = shopifyAvailableInventory(levels)
    if (!source || totalBefore < input.quantity) {
      const compensation = await compensateShopifyInventoryConflict({
        serviceSupabase: input.serviceSupabase,
        orderId: input.orderId,
      })
      if (compensation === "failed") {
        throw new Error(
          "Shopify inventory shortage compensation requires support",
        )
      }
      const mappings = await dbListShopifyMappingsByInventoryItem(
        input.serviceSupabase,
        input.connection.id,
        mapping.shopify_inventory_item_gid,
      )
      await dbUpdateShopifyInventoryListings(
        input.serviceSupabase,
        mappings,
        0,
        input.jobId,
      )
      return
    }
    locationId = source.locationId
    changeFromQuantity = source.available
    await dbPersistShopifyInventoryAttempt(input.serviceSupabase, {
      jobId: input.jobId,
      workerId: input.workerId,
      payload: {
        mappingId: input.mappingId,
        listingId: mapping.listing_id,
        orderId: input.orderId,
        quantity: input.quantity,
        locationId,
        changeFromQuantity,
        remoteTotalBefore: totalBefore,
      },
    })
  }

  await decrementShopifyInventory({
    shopDomain: input.connection.shop_domain,
    accessToken,
    inventoryItemId: mapping.shopify_inventory_item_gid,
    locationId,
    currentAvailable: changeFromQuantity,
    quantity: Math.max(1, Math.floor(input.quantity)),
    idempotencyKey: input.jobId,
  })

  const mappings = await dbListShopifyMappingsByInventoryItem(
    input.serviceSupabase,
    input.connection.id,
    mapping.shopify_inventory_item_gid,
  )
  await dbUpdateShopifyInventoryListings(
    input.serviceSupabase,
    mappings,
    Math.max(0, totalBefore - Math.max(1, Math.floor(input.quantity))),
    input.jobId,
  )
}
