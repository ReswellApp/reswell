import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbListShopifyMappingsForConnection,
  dbRemoveStaleShopifyListings,
  dbUnpublishShopifyMappings,
} from "@/lib/db/shopifyCatalog"
import { fetchShopifyVariantPresence } from "@/lib/shopify/catalog"
import { partitionMappingsByShopifyPresence } from "@/lib/shopify/linked-listings"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { applyShopifyListingSideEffects } from "@/lib/services/shopifyCatalog"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

/**
 * Removes Reswell listings whose Shopify variant no longer exists, in one
 * batched Shopify lookup. Catches deletions whose webhook never arrived.
 * Listings without a Shopify mapping are never read or changed.
 */
export async function sweepDeletedShopifyListings(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
}): Promise<{ removedListingIds: string[]; liveProductIds: string[] }> {
  const mappings = await dbListShopifyMappingsForConnection(
    input.serviceSupabase,
    input.connection.id,
  )
  const staleListingIds = await dbRemoveStaleShopifyListings(
    input.serviceSupabase,
    mappings.filter((mapping) => !mapping.selected).map((m) => m.listing_id),
  )

  const selected = mappings.filter((mapping) => mapping.selected)
  let deletedListingIds: string[] = []
  let liveProductIds: string[] = []
  if (selected.length > 0) {
    const accessToken = await getShopifyAccessToken(
      input.serviceSupabase,
      input.connection,
    )
    const presence = await fetchShopifyVariantPresence({
      shopDomain: input.connection.shop_domain,
      accessToken,
      variantIds: selected.map((mapping) => mapping.shopify_variant_gid),
    })
    const partition = partitionMappingsByShopifyPresence(selected, presence)
    liveProductIds = partition.liveProductIds
    deletedListingIds = await dbUnpublishShopifyMappings(
      input.serviceSupabase,
      partition.missing,
      "deleted",
    )
  }

  const removedListingIds = [
    ...new Set([...staleListingIds, ...deletedListingIds]),
  ]
  if (removedListingIds.length > 0) {
    await applyShopifyListingSideEffects(
      input.serviceSupabase,
      removedListingIds,
    )
  }
  return { removedListingIds, liveProductIds }
}
