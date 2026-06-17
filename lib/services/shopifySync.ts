import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { getShopifyLinkByVariantId, upsertShopifyProductLink } from "@/lib/db/shopify-product-links"
import { listShopifySectionMappingsForUser } from "@/lib/db/shopify-section-mappings"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import {
  fetchShopifyProduct,
  fetchShopifyProductCollections,
} from "@/lib/shopify/admin-api"
import {
  mapShopifyVariantToListing,
  shopifyVariantInStock,
} from "@/lib/shopify/map-product-to-listing-fields"
import { shopifySectionRegistryEntry } from "@/lib/shopify/section-registry"
import { mirrorExternalListingImagesToStorage } from "@/lib/services/importListingImages"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type ShopifySyncVariantResult =
  | { ok: true; listingId: string; action: "created" | "updated" }
  | { ok: false; error: string; unmapped?: boolean }

type SellerProfileLocation = {
  city: string
  state: string
}

async function loadSellerLocation(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellerProfileLocation> {
  const { data } = await supabase
    .from("profiles")
    .select("city, state, shop_address")
    .eq("id", userId)
    .maybeSingle()

  const city = data?.city?.trim() || "United States"
  const state = data?.state?.trim() || "US"
  return { city, state }
}

function listingStatusForVariant(inStock: boolean): "active" | "removed" {
  return inStock ? "active" : "removed"
}

async function syncListingImages(
  supabase: SupabaseClient,
  listingId: string,
  imageUrls: string[],
  userId: string,
  serviceSupabase: SupabaseClient,
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
    await supabase.from("listing_images").delete().eq("listing_id", listingId)
  }

  const rows = mirrored.map((img, index) => ({
    listing_id: listingId,
    url: img.url,
    thumbnail_url: img.thumbnail_url,
    is_primary: index === 0,
    sort_order: index,
  }))

  await supabase.from("listing_images").insert(rows)
}

export async function syncShopifyVariantToListing(opts: {
  supabase: SupabaseClient
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  productId: string
  variantId: string
  sectionOverride?: PeerListingSection | null
  replaceImages?: boolean
}): Promise<ShopifySyncVariantResult> {
  const product = await fetchShopifyProduct({
    shopDomain: opts.connection.shop_domain,
    accessToken: opts.connection.access_token,
    productId: opts.productId,
  })

  if (!product) {
    return { ok: false, error: "Shopify product not found" }
  }

  const variant = product.variants.find((v) => String(v.id) === opts.variantId)
  if (!variant) {
    return { ok: false, error: "Shopify variant not found" }
  }

  const mappings = await listShopifySectionMappingsForUser(
    opts.supabase,
    opts.connection.user_id,
    opts.connection.id,
  )

  let collectionTitles: string[] = []
  try {
    collectionTitles = await fetchShopifyProductCollections({
      shopDomain: opts.connection.shop_domain,
      accessToken: opts.connection.access_token,
      productId: product.id,
    })
  } catch {
    collectionTitles = []
  }

  const mapped = mapShopifyVariantToListing({
    product,
    variant,
    mappings,
    collectionTitles,
    sectionOverride: opts.sectionOverride,
  })

  if (!mapped) {
    return { ok: false, error: "Could not map product to a Reswell section", unmapped: true }
  }

  const registry = shopifySectionRegistryEntry(mapped.section)
  const location = await loadSellerLocation(opts.supabase, opts.connection.user_id)
  const inStock = shopifyVariantInStock(variant)
  const status = listingStatusForVariant(inStock)
  const stockQuantity = Math.max(0, variant.inventory_quantity ?? 0)

  const listingFields: Record<string, unknown> = {
    title: mapped.title,
    description: mapped.description,
    price: mapped.price,
    condition: mapped.condition,
    section: mapped.section,
    category_id: registry.categoryId,
    brand: mapped.brand,
    model: mapped.model,
    city: location.city,
    state: location.state,
    shipping_available: true,
    local_pickup: false,
    shipping_price: 0,
    board_shipping_cost_mode: mapped.section === "surfboards" ? "reswell" : "reswell",
    buyer_offers_enabled: false,
    listing_source: "shopify",
    sync_managed: true,
    stock_quantity: stockQuantity,
    status,
    ...mapped.facetFields,
  }

  if (mapped.section === "surfboards") {
    listingFields.board_type = registry.boardType ?? "other"
  }

  const existingLink = await getShopifyLinkByVariantId(
    opts.serviceSupabase,
    opts.connection.id,
    opts.variantId,
  )

  let listingId: string
  let action: "created" | "updated"

  if (existingLink) {
    const { data: updated, error } = await opts.serviceSupabase
      .from("listings")
      .update({
        ...listingFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingLink.listing_id)
      .eq("user_id", opts.connection.user_id)
      .select("id")
      .single()

    if (error || !updated) {
      return { ok: false, error: error?.message ?? "Failed to update listing" }
    }

    listingId = updated.id as string
    action = "updated"
  } else {
    const slug = await generateUniqueListingSlug(opts.serviceSupabase, mapped.title)
    const { data: inserted, error } = await opts.serviceSupabase
      .from("listings")
      .insert({
        user_id: opts.connection.user_id,
        slug,
        ...listingFields,
      })
      .select("id")
      .single()

    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "Failed to create listing" }
    }

    listingId = inserted.id as string
    action = "created"
  }

  if (opts.replaceImages !== false && mapped.imageUrls.length > 0) {
    await syncListingImages(
      opts.serviceSupabase,
      listingId,
      mapped.imageUrls,
      opts.connection.user_id,
      opts.serviceSupabase,
      action === "created" || opts.replaceImages === true,
    )
  }

  await upsertShopifyProductLink(opts.serviceSupabase, {
    userId: opts.connection.user_id,
    connectionId: opts.connection.id,
    listingId,
    shopifyProductId: String(product.id),
    shopifyVariantId: opts.variantId,
    reswellSection: mapped.section,
    syncStatus: inStock ? "synced" : "archived",
    shopifyUpdatedAt: product.updated_at ?? null,
    lastError: null,
  })

  try {
    await syncListingToIndex(opts.serviceSupabase, listingId)
  } catch {
    // ES optional
  }

  void syncListingToGoogleMerchantBestEffort(opts.serviceSupabase, listingId)
  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(opts.serviceSupabase, opts.connection.user_id)
  revalidateNavSearchSuggest()

  return { ok: true, listingId, action }
}

export async function archiveShopifyLinkedListing(opts: {
  serviceSupabase: SupabaseClient
  connectionId: string
  variantId: string
}): Promise<void> {
  const link = await getShopifyLinkByVariantId(opts.serviceSupabase, opts.connectionId, opts.variantId)
  if (!link) return

  await opts.serviceSupabase
    .from("listings")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", link.listing_id)

  await upsertShopifyProductLink(opts.serviceSupabase, {
    userId: link.user_id,
    connectionId: link.connection_id,
    listingId: link.listing_id,
    shopifyProductId: link.shopify_product_id,
    shopifyVariantId: link.shopify_variant_id,
    reswellSection: link.reswell_section,
    syncStatus: "archived",
    shopifyUpdatedAt: link.shopify_updated_at,
    lastError: null,
  })
}

export async function importShopifyProductAllVariants(opts: {
  supabase: SupabaseClient
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  productId: string
  sectionOverride?: PeerListingSection | null
}): Promise<Array<ShopifySyncVariantResult & { variantId: string }>> {
  const product = await fetchShopifyProduct({
    shopDomain: opts.connection.shop_domain,
    accessToken: opts.connection.access_token,
    productId: opts.productId,
  })

  if (!product) {
    return [{ ok: false, error: "Product not found", variantId: "" }]
  }

  const results: Array<ShopifySyncVariantResult & { variantId: string }> = []

  for (const variant of product.variants) {
    const result = await syncShopifyVariantToListing({
      supabase: opts.supabase,
      serviceSupabase: opts.serviceSupabase,
      connection: opts.connection,
      productId: String(product.id),
      variantId: String(variant.id),
      sectionOverride: opts.sectionOverride,
      replaceImages: true,
    })
    results.push({ ...result, variantId: String(variant.id) })
  }

  return results
}
