import assert from "node:assert/strict"
import test from "node:test"
import {
  deriveShopifyLinkedListingState,
  escapeIlikePattern,
  mapShopifyVariantPresence,
  partitionMappingsByShopifyPresence,
  shopifyAdminProductUrl,
  shopifyLinkedListingFilterSpec,
  shopifyVariantTitle,
} from "@/lib/shopify/linked-listings"
import type {
  ShopifyProductMappingRow,
  ShopifyVariantPresence,
} from "@/lib/shopify/types"

const V1 = "gid://shopify/ProductVariant/1"
const V2 = "gid://shopify/ProductVariant/2"
const V3 = "gid://shopify/ProductVariant/3"

function mapping(variant: string, product: string): ShopifyProductMappingRow {
  return {
    id: `m-${variant}`,
    connection_id: "c",
    listing_id: `l-${variant}`,
    shopify_product_gid: product,
    shopify_variant_gid: variant,
    shopify_inventory_item_gid: "gid://shopify/InventoryItem/1",
    reswell_section: "surfboards",
    selected: true,
    inventory_generation: 0,
    sync_status: "synced",
    remote_updated_at: null,
    last_synced_at: null,
    last_error: null,
  }
}

const livePresence: ShopifyVariantPresence = {
  variantId: V1,
  variantTitle: "6'2\"",
  inventoryQuantity: 3,
  productId: "gid://shopify/Product/10",
  productTitle: "Andreini",
  productStatus: "ACTIVE",
}

test("null nodes mark deleted variants; malformed nodes stay unknown", () => {
  const presence = mapShopifyVariantPresence(
    [V1, V2, V3],
    [
      {
        id: V1,
        title: "6'2\"",
        inventoryQuantity: 3,
        product: { id: "gid://shopify/Product/10", title: "Andreini", status: "ACTIVE" },
      },
      null,
      {},
    ],
  )
  assert.equal(presence.get(V1)?.inventoryQuantity, 3)
  assert.equal(presence.get(V2), null)
  assert.equal(presence.has(V3), false)
})

test("a misaligned Shopify response never reports deletions", () => {
  assert.equal(mapShopifyVariantPresence([V1, V2], [null]).size, 0)
})

test("only confirmed-missing variants are unpublished; their products are not resynced", () => {
  const presence = new Map<string, ShopifyVariantPresence | null>([
    [V1, livePresence],
    [V2, null],
  ])
  const result = partitionMappingsByShopifyPresence(
    [
      mapping(V1, "gid://shopify/Product/10"),
      mapping(V2, "gid://shopify/Product/20"),
      mapping(V3, "gid://shopify/Product/30"),
    ],
    presence,
  )
  assert.deepEqual(result.missing.map((m) => m.shopify_variant_gid), [V2])
  assert.deepEqual(result.liveProductIds, [
    "gid://shopify/Product/10",
    "gid://shopify/Product/30",
  ])
})

test("a product with one deleted variant still resyncs its remaining variants", () => {
  const product = "gid://shopify/Product/10"
  const result = partitionMappingsByShopifyPresence(
    [mapping(V1, product), mapping(V2, product)],
    new Map([[V1, livePresence], [V2, null]]),
  )
  assert.equal(result.missing.length, 1)
  assert.deepEqual(result.liveProductIds, [product])
})

test("deleted in Shopify but still active on Reswell needs removal", () => {
  assert.equal(
    deriveShopifyLinkedListingState({
      syncStatus: "synced",
      reswellStatus: "active",
      presence: null,
    }),
    "needs_removal",
  )
  assert.equal(
    deriveShopifyLinkedListingState({
      syncStatus: "deleted",
      reswellStatus: "removed",
      presence: undefined,
    }),
    "deleted_in_shopify",
  )
})

test("zero stock stays out of stock, not deleted", () => {
  assert.equal(
    deriveShopifyLinkedListingState({
      syncStatus: "out_of_stock",
      reswellStatus: "removed",
      presence: { ...livePresence, inventoryQuantity: 0 },
    }),
    "out_of_stock",
  )
})

test("draft or archived Shopify products are flagged", () => {
  assert.equal(
    deriveShopifyLinkedListingState({
      syncStatus: "synced",
      reswellStatus: "active",
      presence: { ...livePresence, productStatus: "ARCHIVED" },
    }),
    "not_active_in_shopify",
  )
})

test("variant titles prefer Shopify and hide Default Title", () => {
  assert.equal(shopifyVariantTitle("Andreini — 6'2\"", undefined), "6'2\"")
  assert.equal(shopifyVariantTitle("Andreini", undefined), null)
  assert.equal(
    shopifyVariantTitle("Andreini", { ...livePresence, variantTitle: "Default Title" }),
    null,
  )
})

test("admin URL uses the store handle and numeric product id", () => {
  assert.equal(
    shopifyAdminProductUrl("mqzhcg-c8.myshopify.com", "gid://shopify/Product/42"),
    "https://admin.shopify.com/store/mqzhcg-c8/products/42",
  )
})

test("filters map to mapping and listing columns", () => {
  assert.deepEqual(shopifyLinkedListingFilterSpec("live"), { listingStatus: "active" })
  assert.deepEqual(shopifyLinkedListingFilterSpec("deleted"), { syncStatuses: ["deleted"] })
  assert.deepEqual(shopifyLinkedListingFilterSpec("all"), {})
})

test("search input cannot inject ilike wildcards", () => {
  assert.equal(escapeIlikePattern("50%_off\\"), "50\\%\\_off\\\\")
})
