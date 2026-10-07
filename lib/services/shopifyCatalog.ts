import type { SupabaseClient } from "@supabase/supabase-js"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import {
  dbGetShopifyMappingByVariant,
  dbDeleteShopifyListing,
  dbInsertShopifyListing,
  dbListSelectedShopifyProductSections,
  dbListShopifyMappingsByInventoryItem,
  dbListShopifyMappingsByProduct,
  dbLoadShopifyMerchantLocation,
  dbReplaceShopifyListingImage,
  dbUnpublishShopifyMappings,
  dbUpdateShopifyInventoryListings,
  dbUpdateShopifyListing,
  dbSaveShopifyMapping,
} from "@/lib/db/shopifyCatalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_MAGAZINES_CATEGORY_ID } from "@/lib/magazine-listing-config"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { fetchShopifyProduct, fetchShopifyProducts } from "@/lib/shopify/catalog"
import type {
  ShopifyCatalogProduct,
  ShopifyCatalogVariant,
  ShopifyConnectionRow,
  ShopifyProductMappingRow,
} from "@/lib/shopify/types"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"
import {
  getShopifyImportFulfillmentDefaults,
  type ShopifyImportFulfillmentDefaults,
} from "@/lib/services/shopifyShipping"
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
  for (let index = 0; index < listingIds.length; index += 10) {
    await Promise.all(
      listingIds.slice(index, index + 10).map(async (listingId) => {
        try {
          await syncListingToIndex(serviceSupabase, listingId)
        } catch {
          // Elasticsearch is optional.
        }
        syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
      }),
    )
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
  fulfillmentDefaults: ShopifyImportFulfillmentDefaults
  expectedMapping?: ShopifyProductMappingRow
}): Promise<string> {
  const existing =
    input.expectedMapping ??
    (await dbGetShopifyMappingByVariant(
      input.serviceSupabase,
      input.connection.id,
      input.variant.id,
    ))
  const remoteStock =
    input.product.status === "ACTIVE"
      ? input.variant.available
      : 0
  const syncedFields: Record<string, unknown> = {
    title: listingTitle(input.product, input.variant),
    description: input.product.description,
    price: input.variant.price,
    compare_at_price: input.variant.compareAtPrice,
    condition: "brand_new",
    section: input.section,
    category_id: SECTION_CATEGORY[input.section],
    brand: input.product.vendor,
    model: input.product.title,
    inventory_source: "shopify",
  }
  const initialReswellFields: Record<string, unknown> = {
    user_id: input.connection.user_id,
    city: input.city,
    state: input.state,
    buyer_offers_enabled: false,
    hidden_from_site: false,
    site_visibility_reason: null,
    ...input.fulfillmentDefaults,
    ...(input.section === "surfboards" ? { board_type: "other" } : {}),
    ...(input.section === "apparel" ? { apparel_kind: "other" } : {}),
    ...(input.section === "traction" ? { traction_size: "other" } : {}),
  }

  let listingId = existing?.listing_id ?? null
  let createdListing = false
  if (listingId) {
    await dbUpdateShopifyListing(
      input.serviceSupabase,
      listingId,
      syncedFields,
    )
  } else {
    listingId = await dbInsertShopifyListing(input.serviceSupabase, {
      ...syncedFields,
      ...initialReswellFields,
      stock_quantity: 0,
      status: "removed",
      slug: await generateUniqueListingSlug(
        input.serviceSupabase,
        String(syncedFields.title),
      ),
    })
    createdListing = true
  }
  await dbReplaceShopifyListingImage(
    input.serviceSupabase,
    listingId,
    input.variant.imageUrl ?? input.product.imageUrl,
  )
  const saved = await dbSaveShopifyMapping(input.serviceSupabase, {
    mappingId: existing?.id ?? null,
    connectionId: input.connection.id,
    listingId,
    productId: input.product.id,
    variantId: input.variant.id,
    inventoryItemId: input.variant.inventoryItemId,
    section: input.section,
    status: remoteStock > 0 ? "synced" : "out_of_stock",
    remoteUpdatedAt: input.product.updatedAt,
  })
  if (saved && createdListing) {
    await dbUpdateShopifyListing(
      input.serviceSupabase,
      listingId,
      syncedFields,
    )
  }
  if (!saved && createdListing) {
    await dbDeleteShopifyListing(input.serviceSupabase, listingId)
    const winner = await dbGetShopifyMappingByVariant(
      input.serviceSupabase,
      input.connection.id,
      input.variant.id,
    )
    if (!winner) throw new Error("Concurrent Shopify import did not create a mapping")
    listingId = winner.listing_id
    await dbUpdateShopifyListing(
      input.serviceSupabase,
      listingId,
      syncedFields,
    )
    await dbReplaceShopifyListingImage(
      input.serviceSupabase,
      listingId,
      input.variant.imageUrl ?? input.product.imageUrl,
    )
    await dbSaveShopifyMapping(input.serviceSupabase, {
      mappingId: winner.id,
      connectionId: input.connection.id,
      listingId,
      productId: input.product.id,
      variantId: input.variant.id,
      inventoryItemId: input.variant.inventoryItemId,
      section: input.section,
      status: remoteStock > 0 ? "synced" : "out_of_stock",
      remoteUpdatedAt: input.product.updatedAt,
    })
  }
  const currentMapping = await dbGetShopifyMappingByVariant(
    input.serviceSupabase,
    input.connection.id,
    input.variant.id,
  )
  if (!currentMapping) throw new Error("Shopify mapping was not persisted")
  await dbUpdateShopifyInventoryListings(
    input.serviceSupabase,
    [input.expectedMapping ?? currentMapping],
    remoteStock,
  )
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

  const [location, fulfillmentDefaults] = await Promise.all([
    dbLoadShopifyMerchantLocation(
      input.serviceSupabase,
      input.connection.user_id,
    ),
    getShopifyImportFulfillmentDefaults(
      input.serviceSupabase,
      input.connection.user_id,
      selectedSection,
    ),
  ])
  const listingIds: string[] = []
  const existingByVariant = new Map(
    existing.map((mapping) => [mapping.shopify_variant_gid, mapping]),
  )
  for (let index = 0; index < product.variants.length; index += 5) {
    const batch = product.variants.slice(index, index + 5)
    listingIds.push(
      ...(await Promise.all(
        batch.map((variant) =>
          syncVariant({
            serviceSupabase: input.serviceSupabase,
            connection: input.connection,
            product,
            variant,
            section: selectedSection,
            expectedMapping: existingByVariant.get(variant.id),
            fulfillmentDefaults,
            ...location,
          }),
        ),
      )),
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
  const listingIds: string[] = []
  const productIds = [
    ...new Set(mappings.map((mapping) => mapping.shopify_product_gid)),
  ]
  for (const productId of productIds) {
    const synced = await syncSelectedShopifyProduct({
      serviceSupabase: input.serviceSupabase,
      connection: input.connection,
      productId,
    })
    listingIds.push(...synced.listingIds)
  }
  return [...new Set(listingIds)]
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
