import type { SupabaseClient } from "@supabase/supabase-js"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { ShopifyProductMappingRow } from "@/lib/shopify/types"

const MAPPING_SELECT = [
  "id",
  "connection_id",
  "listing_id",
  "shopify_product_gid",
  "shopify_variant_gid",
  "shopify_inventory_item_gid",
  "reswell_section",
  "selected",
  "sync_status",
  "remote_updated_at",
  "last_synced_at",
  "last_error",
].join(",")

export async function dbListShopifyMappingsForConnection(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<ShopifyProductMappingRow[]> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select(MAPPING_SELECT)
    .eq("connection_id", connectionId)
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifyProductMappingRow[]
}

export async function dbListSelectedShopifyProductSections(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<Map<string, PeerListingSection>> {
  const mappings = await dbListShopifyMappingsForConnection(
    supabase,
    connectionId,
  )
  const selected = new Map<string, PeerListingSection>()
  for (const mapping of mappings) {
    if (mapping.selected) {
      selected.set(mapping.shopify_product_gid, mapping.reswell_section)
    }
  }
  return selected
}

export async function dbListSelectedShopifyProductIds(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select("shopify_product_gid")
    .eq("connection_id", connectionId)
    .eq("selected", true)
  if (error) throw new Error(error.message)
  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.shopify_product_gid)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]
}

export async function dbGetShopifyMappingByVariant(
  supabase: SupabaseClient,
  connectionId: string,
  variantId: string,
): Promise<ShopifyProductMappingRow | null> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select(MAPPING_SELECT)
    .eq("connection_id", connectionId)
    .eq("shopify_variant_gid", variantId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyProductMappingRow | null) ?? null
}

export async function dbGetShopifyMappingById(
  supabase: SupabaseClient,
  mappingId: string,
): Promise<ShopifyProductMappingRow | null> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select(MAPPING_SELECT)
    .eq("id", mappingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyProductMappingRow | null) ?? null
}

export async function dbListShopifyMappingsByProduct(
  supabase: SupabaseClient,
  connectionId: string,
  productId: string,
): Promise<ShopifyProductMappingRow[]> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select(MAPPING_SELECT)
    .eq("connection_id", connectionId)
    .eq("shopify_product_gid", productId)
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifyProductMappingRow[]
}

export async function dbListShopifyMappingsByInventoryItem(
  supabase: SupabaseClient,
  connectionId: string,
  inventoryItemId: string,
): Promise<ShopifyProductMappingRow[]> {
  const { data, error } = await supabase
    .from("shopify_product_mappings")
    .select(MAPPING_SELECT)
    .eq("connection_id", connectionId)
    .eq("shopify_inventory_item_gid", inventoryItemId)
    .eq("selected", true)
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifyProductMappingRow[]
}

export async function dbLoadShopifyMerchantLocation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ city: string; state: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("city, state, location")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    city: data?.city?.trim() || data?.location?.trim() || "United States",
    state: data?.state?.trim() || "US",
  }
}

export async function dbInsertShopifyListing(
  supabase: SupabaseClient,
  fields: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("listings")
    .insert(fields)
    .select("id")
    .single()
  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create Shopify listing")
  }
  return String(data.id)
}

export async function dbUpdateShopifyListing(
  supabase: SupabaseClient,
  listingId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("inventory_source", "shopify")
  if (error) throw new Error(error.message)
}

export async function dbReplaceShopifyListingImage(
  supabase: SupabaseClient,
  listingId: string,
  imageUrl: string | null,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("listing_images")
    .delete()
    .eq("listing_id", listingId)
  if (deleteError) throw new Error(deleteError.message)
  if (!imageUrl) return
  const { error } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    url: imageUrl,
    thumbnail_url: imageUrl,
    is_primary: true,
    sort_order: 0,
  })
  if (error) throw new Error(error.message)
}

export async function dbSaveShopifyMapping(
  supabase: SupabaseClient,
  input: {
    mappingId: string | null
    connectionId: string
    listingId: string
    productId: string
    variantId: string
    inventoryItemId: string
    section: PeerListingSection
    status: ShopifyProductMappingRow["sync_status"]
    remoteUpdatedAt: string | null
  },
): Promise<boolean> {
  const now = new Date().toISOString()
  const fields = {
    connection_id: input.connectionId,
    listing_id: input.listingId,
    shopify_product_gid: input.productId,
    shopify_variant_gid: input.variantId,
    shopify_inventory_item_gid: input.inventoryItemId,
    reswell_section: input.section,
    selected: true,
    sync_status: input.status,
    remote_updated_at: input.remoteUpdatedAt,
    last_synced_at: now,
    last_error: null,
    updated_at: now,
  }
  if (input.mappingId) {
    const { error } = await supabase
      .from("shopify_product_mappings")
      .update(fields)
      .eq("id", input.mappingId)
    if (error) throw new Error(error.message)
    return true
  }
  const { error } = await supabase
    .from("shopify_product_mappings")
    .insert(fields)
  if (!error) return true
  if (error.code === "23505") return false
  throw new Error(error.message)
}

export async function dbDeleteShopifyListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("inventory_source", "shopify")
  if (error) throw new Error(error.message)
}

export async function dbMarkShopifyMappingError(
  supabase: SupabaseClient,
  mappingId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("shopify_product_mappings")
    .update({
      sync_status: "error",
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", mappingId)
}

export async function dbUnpublishShopifyMappings(
  supabase: SupabaseClient,
  mappings: ShopifyProductMappingRow[],
  status: "deleted" | "unselected" | "out_of_stock",
): Promise<string[]> {
  if (mappings.length === 0) return []
  const mappingIds = mappings.map((mapping) => mapping.id)
  const listingIds = mappings.map((mapping) => mapping.listing_id)
  const now = new Date().toISOString()
  const { error: mappingError } = await supabase
    .from("shopify_product_mappings")
    .update({
      selected: status === "out_of_stock",
      sync_status: status,
      last_synced_at: now,
      updated_at: now,
    })
    .in("id", mappingIds)
  if (mappingError) throw new Error(mappingError.message)

  const { error: listingError } = await supabase
    .from("listings")
    .update({ status: "removed", stock_quantity: 0, updated_at: now })
    .in("id", listingIds)
    .eq("inventory_source", "shopify")
  if (listingError) throw new Error(listingError.message)
  return listingIds
}

export async function dbUnpublishAllShopifyListingsForConnection(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<string[]> {
  const mappings = await dbListShopifyMappingsForConnection(
    supabase,
    connectionId,
  )
  return dbUnpublishShopifyMappings(supabase, mappings, "unselected")
}

export async function dbUpdateShopifyInventoryListings(
  supabase: SupabaseClient,
  mappings: ShopifyProductMappingRow[],
  stockQuantity: number,
): Promise<string[]> {
  if (mappings.length === 0) return []
  const listingIds = mappings.map((mapping) => mapping.listing_id)
  const stock = Math.max(0, Math.floor(stockQuantity))
  const now = new Date().toISOString()
  const { error: listingError } = await supabase
    .from("listings")
    .update({
      stock_quantity: stock,
      status: stock > 0 ? "active" : "removed",
      updated_at: now,
    })
    .in("id", listingIds)
    .eq("inventory_source", "shopify")
  if (listingError) throw new Error(listingError.message)

  const { error: mappingError } = await supabase
    .from("shopify_product_mappings")
    .update({
      sync_status: stock > 0 ? "synced" : "out_of_stock",
      last_synced_at: now,
      last_error: null,
      updated_at: now,
    })
    .in(
      "id",
      mappings.map((mapping) => mapping.id),
    )
  if (mappingError) throw new Error(mappingError.message)
  return listingIds
}

export async function dbRecordShopifyListingSale(
  supabase: SupabaseClient,
  input: {
    orderId: string
    listingId: string
    quantity: number
  },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("record_shopify_listing_sale", {
    p_order_id: input.orderId,
    p_listing_id: input.listingId,
    p_quantity: input.quantity,
  })
  if (error) throw new Error(error.message)
  return data === true
}
