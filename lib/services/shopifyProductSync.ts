import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import {
  getShopifyLinkByProductId,
  upsertShopifyProductLinkByProduct,
} from "@/lib/db/shopify-product-links"
import { syncListingVariants } from "@/lib/db/listing-variants"
import { listShopifySectionMappingsForUser } from "@/lib/db/shopify-section-mappings"
import { fetchShopifyProduct, fetchShopifyProductCollections } from "@/lib/shopify/admin-api"
import { mapShopifyProductToListing } from "@/lib/shopify/map-product-to-listing-fields"
import { shopifySectionRegistryEntry } from "@/lib/shopify/section-registry"
import { mirrorExternalListingImagesToStorage } from "@/lib/services/importListingImages"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import type { ShopifyConnectionRow, ShopifyPricingMode } from "@/lib/shopify/types"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type ShopifyProductSyncResult =
  | { ok: true; listingId: string; action: "created" | "updated"; variantCount: number }
  | { ok: false; error: string; unmapped?: boolean }

async function loadSellerLocation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ city: string; state: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("city, state")
    .eq("id", userId)
    .maybeSingle()
  return {
    city: data?.city?.trim() || "United States",
    state: data?.state?.trim() || "US",
  }
}

function applyPricing(price: number, mode: ShopifyPricingMode, markupPercent: number): number {
  if (mode === "markup" && markupPercent > 0) {
    return Math.round(price * (1 + markupPercent / 100) * 100) / 100
  }
  return price
}

async function syncListingImages(
  serviceSupabase: SupabaseClient,
  listingId: string,
  imageUrls: string[],
  userId: string,
  replaceExisting: boolean,
): Promise<void> {
  if (imageUrls.length === 0) return
  const mirrored = await mirrorExternalListingImagesToStorage({
    supabase: serviceSupabase,
    userId,
    imageUrls: imageUrls.slice(0, 12),
  })
  if (mirrored.length === 0) return

  if (replaceExisting) {
    await serviceSupabase.from("listing_images").delete().eq("listing_id", listingId)
  }
  const rows = mirrored.map((img, index) => ({
    listing_id: listingId,
    url: img.url,
    thumbnail_url: img.thumbnail_url,
    is_primary: index === 0,
    sort_order: index,
  }))
  await serviceSupabase.from("listing_images").insert(rows)
}

/**
 * Sync one Shopify product into a single Reswell listing + its variant units.
 * Idempotent: keyed on the product-level shopify_product_links row.
 */
export async function syncShopifyProductToListing(opts: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  productId: string
  sectionOverride?: PeerListingSection | null
  replaceImages?: boolean
}): Promise<ShopifyProductSyncResult> {
  const { serviceSupabase, connection } = opts

  const product = await fetchShopifyProduct({
    shopDomain: connection.shop_domain,
    accessToken: connection.access_token,
    productId: opts.productId,
  })
  if (!product) return { ok: false, error: "Shopify product not found" }

  const mappings = await listShopifySectionMappingsForUser(
    serviceSupabase,
    connection.user_id,
    connection.id,
  )

  let collectionTitles: string[] = []
  try {
    collectionTitles = await fetchShopifyProductCollections({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      productId: product.id,
    })
  } catch {
    collectionTitles = []
  }

  const mapped = mapShopifyProductToListing({
    product,
    mappings,
    collectionTitles,
    sectionOverride: opts.sectionOverride,
  })
  if (!mapped) {
    return { ok: false, error: "Could not map product to a Reswell section", unmapped: true }
  }

  const registry = shopifySectionRegistryEntry(mapped.section)
  const location = await loadSellerLocation(serviceSupabase, connection.user_id)
  const totalStock = mapped.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
  const anyInStock = mapped.variants.some((v) => v.inStock)
  const displayPrice = applyPricing(mapped.price, connection.pricing_mode, connection.markup_percent)

  const listingFields: Record<string, unknown> = {
    title: mapped.title,
    description: mapped.description,
    price: displayPrice,
    condition: "brand_new",
    section: mapped.section,
    category_id: registry.categoryId,
    brand: mapped.brand,
    city: location.city,
    state: location.state,
    shipping_available: true,
    local_pickup: false,
    shipping_price: 0,
    board_shipping_cost_mode: "reswell",
    buyer_offers_enabled: false,
    listing_source: "shopify",
    sync_managed: true,
    has_variants: mapped.hasVariants,
    is_retail: true,
    stock_quantity: totalStock,
    status: anyInStock ? "active" : "removed",
    ...mapped.facetFields,
  }
  if (mapped.section === "surfboards") {
    listingFields.board_type = registry.boardType ?? "other"
  }

  const existingLink = await getShopifyLinkByProductId(serviceSupabase, connection.id, String(product.id))

  let listingId: string
  let action: "created" | "updated"

  if (existingLink) {
    const { data: updated, error } = await serviceSupabase
      .from("listings")
      .update({ ...listingFields, updated_at: new Date().toISOString() })
      .eq("id", existingLink.listing_id)
      .eq("user_id", connection.user_id)
      .select("id")
      .single()
    if (error || !updated) return { ok: false, error: error?.message ?? "Failed to update listing" }
    listingId = updated.id as string
    action = "updated"
  } else {
    const slug = await generateUniqueListingSlug(serviceSupabase, mapped.title)
    const { data: inserted, error } = await serviceSupabase
      .from("listings")
      .insert({ user_id: connection.user_id, slug, ...listingFields })
      .select("id")
      .single()
    if (error || !inserted) return { ok: false, error: error?.message ?? "Failed to create listing" }
    listingId = inserted.id as string
    action = "created"
  }

  await syncListingVariants(
    serviceSupabase,
    listingId,
    mapped.variants.map((v) => ({
      shopifyVariantId: v.shopifyVariantId,
      title: v.title,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      sku: v.sku,
      price: applyPricing(v.price, connection.pricing_mode, connection.markup_percent),
      stockQuantity: v.stockQuantity,
      inStock: v.inStock,
      position: v.position,
    })),
  )

  if (opts.replaceImages !== false && mapped.imageUrls.length > 0) {
    await syncListingImages(
      serviceSupabase,
      listingId,
      mapped.imageUrls,
      connection.user_id,
      action === "created" || opts.replaceImages === true,
    )
  }

  await upsertShopifyProductLinkByProduct(serviceSupabase, {
    userId: connection.user_id,
    connectionId: connection.id,
    listingId,
    shopifyProductId: String(product.id),
    reswellSection: mapped.section,
    syncStatus: anyInStock ? "synced" : "archived",
    shopifyUpdatedAt: product.updated_at ?? null,
    lastError: null,
  })

  try {
    await syncListingToIndex(serviceSupabase, listingId)
  } catch {
    /* ES optional */
  }
  void syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(serviceSupabase, connection.user_id)
  revalidateNavSearchSuggest()

  return { ok: true, listingId, action, variantCount: mapped.variants.length }
}

/** Archive the listing for a deleted Shopify product. */
export async function archiveShopifyProductListing(opts: {
  serviceSupabase: SupabaseClient
  connectionId: string
  productId: string
}): Promise<void> {
  const link = await getShopifyLinkByProductId(opts.serviceSupabase, opts.connectionId, opts.productId)
  if (!link) return

  await opts.serviceSupabase
    .from("listings")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", link.listing_id)

  await opts.serviceSupabase
    .from("shopify_product_links")
    .update({ sync_status: "archived", updated_at: new Date().toISOString() })
    .eq("id", link.id)
}
