import type { SupabaseClient } from "@supabase/supabase-js"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import {
  dbGetShopifyMappingByVariant,
  dbInsertShopifyListing,
  dbListSelectedShopifyProductSections,
  dbListShopifyMappingsByInventoryItem,
  dbListShopifyMappingsByProduct,
  dbLoadShopifyMerchantLocation,
  dbReplaceShopifyListingImage,
  dbUnpublishShopifyMappings,
  dbUpdateShopifyInventoryListings,
  dbUpdateShopifyListing,
  dbUpsertShopifyMapping,
} from "@/lib/db/shopifyCatalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_MAGAZINES_CATEGORY_ID } from "@/lib/magazine-listing-config"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import {
  fetchShopifyInventoryLevels,
  fetchShopifyProduct,
  fetchShopifyProducts,
  shopifyAvailableInventory,
} from "@/lib/shopify/catalog"
import type {
  ShopifyCatalogProduct,
  ShopifyCatalogVariant,
  ShopifyConnectionRow,
} from "@/lib/shopify/types"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_TRACTION_CATEGORY_ID } from "@/lib/traction-listing-config"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"

const SECTION_CATEGORY: Record<PeerListingSection, string> = {
  surfboards: boardCategoryMap.other,
  fins: USED_FINS_CATEGORY_ID,
  wetsuits: USED_WETSUITS_CATEGORY_ID,
  boardbags: USED_BOARDBAGS_CATEGORY_ID,
  surfpacks: USED_SURFPACKS_CATEGORY_ID,
  leashes: USED_LEASHES_CATEGORY_ID,
  apparel: USED_APPAREL_CATEGORY_ID,
  accessories: USED_ACCESSORIES_CATEGORY_ID,
  magazines: USED_MAGAZINES_CATEGORY_ID,
  traction: USED_TRACTION_CATEGORY_ID,
}

function listingTitle(
  product: ShopifyCatalogProduct,
  variant: ShopifyCatalogVariant,
): string {
  const variantTitle = variant.title.trim()
  if (!variantTitle || variantTitle.toLowerCase() === "default title") {
    return product.title
  }
  return `${product.title} — ${variantTitle}`
}

export async function applyShopifyListingSideEffects(
  serviceSupabase: SupabaseClient,
  listingIds: string[],
): Promise<void> {
  for (const listingId of listingIds) {
    try {
      await syncListingToIndex(serviceSupabase, listingId)
    } catch {
      // Elasticsearch is optional.
    }
    syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
  }
  await revalidateAfterListingSiteModeration(serviceSupabase, listingIds)
}

export async function listShopifyProductsForMerchant(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  query?: string
  after?: string | null
}): Promise<{
  products: ShopifyCatalogProduct[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}> {
  const [accessToken, selected] = await Promise.all([
    getShopifyAccessToken(input.serviceSupabase, input.connection),
    dbListSelectedShopifyProductSections(
      input.serviceSupabase,
      input.connection.id,
    ),
  ])
  const page = await fetchShopifyProducts({
    shopDomain: input.connection.shop_domain,
    accessToken,
    query: input.query,
    after: input.after,
  })
  return {
    ...page,
    products: page.products.map((product) => ({
      ...product,
      selected: selected.has(product.id),
      selectedSection: selected.get(product.id) ?? null,
    })),
  }
}

async function syncVariant(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  product: ShopifyCatalogProduct
  variant: ShopifyCatalogVariant
  section: PeerListingSection
  city: string
  state: string
}): Promise<string> {
  const existing = await dbGetShopifyMappingByVariant(
    input.serviceSupabase,
    input.connection.id,
    input.variant.id,
  )
  const stock =
    input.product.status === "ACTIVE"
      ? shopifyAvailableInventory(input.variant.inventoryLevels)
      : 0
  const fields: Record<string, unknown> = {
    user_id: input.connection.user_id,
    title: listingTitle(input.product, input.variant),
    description: input.product.description,
    price: input.variant.price,
    compare_at_price: input.variant.compareAtPrice,
    condition: "brand_new",
    section: input.section,
    category_id: SECTION_CATEGORY[input.section],
    brand: input.product.vendor,
    model: input.product.title,
    city: input.city,
    state: input.state,
    shipping_available: true,
    local_pickup: false,
    shipping_price: 0,
    board_shipping_cost_mode: "reswell",
    buyer_offers_enabled: false,
    stock_quantity: stock,
    status: stock > 0 ? "active" : "removed",
    hidden_from_site: false,
    site_visibility_reason: null,
    inventory_source: "shopify",
    ...(input.section === "surfboards" ? { board_type: "other" } : {}),
    ...(input.section === "apparel" ? { apparel_kind: "other" } : {}),
    ...(input.section === "traction" ? { traction_size: "other" } : {}),
  }

  let listingId = existing?.listing_id ?? null
  if (listingId) {
    await dbUpdateShopifyListing(input.serviceSupabase, listingId, fields)
  } else {
    listingId = await dbInsertShopifyListing(input.serviceSupabase, {
      ...fields,
      slug: await generateUniqueListingSlug(
        input.serviceSupabase,
        String(fields.title),
      ),
    })
  }
  await dbReplaceShopifyListingImage(
    input.serviceSupabase,
    listingId,
    input.variant.imageUrl ?? input.product.imageUrl,
  )
  await dbUpsertShopifyMapping(input.serviceSupabase, {
    connectionId: input.connection.id,
    listingId,
    productId: input.product.id,
    variantId: input.variant.id,
    inventoryItemId: input.variant.inventoryItemId,
    section: input.section,
    status: stock > 0 ? "synced" : "out_of_stock",
    remoteUpdatedAt: input.product.updatedAt,
  })
  return listingId
}

export async function syncSelectedShopifyProduct(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  productId: string
  section?: PeerListingSection
}): Promise<{ listingIds: string[]; productMissing: boolean }> {
  const existing = await dbListShopifyMappingsByProduct(
    input.serviceSupabase,
    input.connection.id,
    input.productId,
  )
  const selectedSection =
    input.section ?? existing.find((mapping) => mapping.selected)?.reswell_section
  if (!selectedSection) {
    return { listingIds: [], productMissing: false }
  }

  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  const product = await fetchShopifyProduct({
    shopDomain: input.connection.shop_domain,
    accessToken,
    productId: input.productId,
  })
  if (!product) {
    const listingIds = await dbUnpublishShopifyMappings(
      input.serviceSupabase,
      existing,
      "deleted",
    )
    await applyShopifyListingSideEffects(input.serviceSupabase, listingIds)
    return { listingIds, productMissing: true }
  }
  if (product.variants.length === 0) {
    throw new Error("This Shopify product has no sellable variants")
  }

  const location = await dbLoadShopifyMerchantLocation(
    input.serviceSupabase,
    input.connection.user_id,
  )
  const listingIds: string[] = []
  for (const variant of product.variants) {
    listingIds.push(
      await syncVariant({
        serviceSupabase: input.serviceSupabase,
        connection: input.connection,
        product,
        variant,
        section: selectedSection,
        ...location,
      }),
    )
  }

  const currentVariantIds = new Set(product.variants.map((variant) => variant.id))
  const removed = existing.filter(
    (mapping) => !currentVariantIds.has(mapping.shopify_variant_gid),
  )
  listingIds.push(
    ...(await dbUnpublishShopifyMappings(
      input.serviceSupabase,
      removed,
      "deleted",
    )),
  )

  await applyShopifyListingSideEffects(
    input.serviceSupabase,
    [...new Set(listingIds)],
  )
  return { listingIds: [...new Set(listingIds)], productMissing: false }
}

export async function unpublishSelectedShopifyProduct(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  productId: string
}): Promise<string[]> {
  const mappings = await dbListShopifyMappingsByProduct(
    input.serviceSupabase,
    input.connection.id,
    input.productId,
  )
  const listingIds = await dbUnpublishShopifyMappings(
    input.serviceSupabase,
    mappings,
    "unselected",
  )
  await applyShopifyListingSideEffects(input.serviceSupabase, listingIds)
  return listingIds
}

export async function syncShopifyInventoryItem(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  inventoryItemId: string
}): Promise<string[]> {
  const mappings = await dbListShopifyMappingsByInventoryItem(
    input.serviceSupabase,
    input.connection.id,
    input.inventoryItemId,
  )
  if (mappings.length === 0) return []
  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  const levels = await fetchShopifyInventoryLevels({
    shopDomain: input.connection.shop_domain,
    accessToken,
    inventoryItemId: input.inventoryItemId,
  })
  const listingIds = await dbUpdateShopifyInventoryListings(
    input.serviceSupabase,
    mappings,
    shopifyAvailableInventory(levels),
  )
  await applyShopifyListingSideEffects(input.serviceSupabase, listingIds)
  return listingIds
}

export async function unpublishDeletedShopifyProduct(input: {
  serviceSupabase: SupabaseClient
  connectionId: string
  productId: string
}): Promise<string[]> {
  const mappings = await dbListShopifyMappingsByProduct(
    input.serviceSupabase,
    input.connectionId,
    input.productId,
  )
  const listingIds = await dbUnpublishShopifyMappings(
    input.serviceSupabase,
    mappings,
    "deleted",
  )
  await applyShopifyListingSideEffects(input.serviceSupabase, listingIds)
  return listingIds
}
