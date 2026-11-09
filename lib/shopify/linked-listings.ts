import type {
  ShopifyLinkedListingFilter,
  ShopifyLinkedListingState,
  ShopifyProductMappingRow,
  ShopifyVariantPresence,
} from "@/lib/shopify/types"

type RawPresenceNode = {
  id?: string | null
  title?: string | null
  inventoryQuantity?: number | null
  product?: {
    id?: string | null
    title?: string | null
    status?: string | null
  } | null
} | null

/**
 * Shopify's `nodes(ids:)` returns `null` in the slot of an id that no longer
 * exists. Only those slots count as deleted; malformed nodes stay unknown so a
 * partial response can never unpublish a live listing.
 */
export function mapShopifyVariantPresence(
  ids: string[],
  nodes: unknown[],
): Map<string, ShopifyVariantPresence | null> {
  const presence = new Map<string, ShopifyVariantPresence | null>()
  if (nodes.length !== ids.length) return presence
  ids.forEach((id, index) => {
    const node = nodes[index] as RawPresenceNode
    if (node === null) {
      presence.set(id, null)
      return
    }
    const productId = node?.product?.id?.trim()
    if (node?.id !== id || !productId) return
    presence.set(id, {
      variantId: id,
      variantTitle: node.title?.trim() || "",
      inventoryQuantity: Math.max(
        0,
        Math.floor(Number(node.inventoryQuantity ?? 0) || 0),
      ),
      productId,
      productTitle: node.product?.title?.trim() || "",
      productStatus: node.product?.status?.trim() || "DRAFT",
    })
  })
  return presence
}

export function partitionMappingsByShopifyPresence(
  mappings: ShopifyProductMappingRow[],
  presence: Map<string, ShopifyVariantPresence | null>,
): { missing: ShopifyProductMappingRow[]; liveProductIds: string[] } {
  const missing: ShopifyProductMappingRow[] = []
  const liveProductIds = new Set<string>()
  for (const mapping of mappings) {
    if (presence.get(mapping.shopify_variant_gid) === null) {
      missing.push(mapping)
    } else {
      liveProductIds.add(mapping.shopify_product_gid)
    }
  }
  return { missing, liveProductIds: [...liveProductIds] }
}

export function deriveShopifyLinkedListingState(input: {
  syncStatus: ShopifyProductMappingRow["sync_status"]
  reswellStatus: string
  presence: ShopifyVariantPresence | null | undefined
}): ShopifyLinkedListingState {
  const live = input.reswellStatus === "active"
  const goneInShopify = input.presence === null || input.syncStatus === "deleted"
  if (goneInShopify) return live ? "needs_removal" : "deleted_in_shopify"
  if (input.syncStatus === "unselected") {
    return live ? "needs_removal" : "unpublished"
  }
  if (input.syncStatus === "error") return "error"
  if (input.presence && input.presence.productStatus !== "ACTIVE") {
    return "not_active_in_shopify"
  }
  return live ? "live" : "out_of_stock"
}

export function shopifyVariantTitle(
  listingTitle: string,
  presence: ShopifyVariantPresence | null | undefined,
): string | null {
  const fromShopify = presence?.variantTitle.trim()
  const raw =
    fromShopify ??
    (listingTitle.includes(" — ")
      ? listingTitle.slice(listingTitle.lastIndexOf(" — ") + 3).trim()
      : "")
  if (!raw || raw.toLowerCase() === "default title") return null
  return raw
}

export function shopifyAdminProductUrl(
  shopDomain: string,
  productGid: string,
): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, "")
  const numericId = productGid.split("/").pop() ?? ""
  return `https://admin.shopify.com/store/${encodeURIComponent(handle)}/products/${encodeURIComponent(numericId)}`
}

export interface ShopifyLinkedListingFilterSpec {
  listingStatus?: "active"
  syncStatuses?: ShopifyProductMappingRow["sync_status"][]
  selected?: boolean
}

export function shopifyLinkedListingFilterSpec(
  filter: ShopifyLinkedListingFilter,
): ShopifyLinkedListingFilterSpec {
  switch (filter) {
    case "live":
      return { listingStatus: "active" }
    case "out_of_stock":
      return { syncStatuses: ["out_of_stock"], selected: true }
    case "deleted":
      return { syncStatuses: ["deleted"] }
    case "unpublished":
      return { syncStatuses: ["unselected"] }
    case "error":
      return { syncStatuses: ["error"] }
    default:
      return {}
  }
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
